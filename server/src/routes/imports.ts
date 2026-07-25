import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { parseCsv, suggestMapping, normalizeRows, detectDateFormat, ColumnMapping } from "../services/csvImport";
import { parseIndmoneyPayload } from "../services/indmoneyImport";
import { commitImportRows } from "../services/importCommit";

export const importsRouter = Router();

const previewSchema = z.object({
  fileContent: z.string().min(1),
  filename: z.string().default("statement.csv"),
});

importsRouter.post("/:accountId/preview", async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = await prisma.account.findUnique({
    where: { id: req.params.accountId },
    include: { groups: { where: { archived: false } } },
  });
  if (!account) return res.status(404).json({ error: "Account not found" });

  const { headers, rows } = parseCsv(parsed.data.fileContent);
  if (headers.length === 0) return res.status(400).json({ error: "Could not find a header row in this CSV" });

  // Only offer the account's last mapping back if this file actually has the
  // same columns - a different statement format uploaded to the same account
  // shouldn't silently reuse a stale mapping.
  let savedMapping: ColumnMapping | null = null;
  if (account.lastImportMapping) {
    try {
      const candidate = JSON.parse(account.lastImportMapping) as ColumnMapping;
      const referencedColumns = [candidate.dateColumn, candidate.descriptionColumn, candidate.amountColumn, candidate.debitColumn, candidate.creditColumn].filter(
        (c): c is string => Boolean(c)
      );
      if (referencedColumns.every((c) => headers.includes(c))) {
        savedMapping = candidate;
      }
    } catch {
      // ignore malformed stored mapping
    }
  }

  const savedGroupId =
    account.lastImportGroupId && account.groups.some((g) => g.id === account.lastImportGroupId) ? account.lastImportGroupId : null;

  const suggestedMapping = suggestMapping(headers);
  // Detect against every row (not just the preview sample) so a single
  // disambiguating date late in the file - e.g. one "25/03/2026" - is enough
  // to catch a day-first file even if the first 10 rows are all ambiguous.
  const dateColumnForDetection = savedMapping?.dateColumn ?? suggestedMapping.dateColumn;
  const suggestedDateFormat = dateColumnForDetection
    ? detectDateFormat(rows.map((r) => r[dateColumnForDetection] ?? ""))
    : "DMY";

  res.json({
    headers,
    sampleRows: rows.slice(0, 10),
    rowCount: rows.length,
    suggestedMapping,
    suggestedDateFormat,
    savedMapping,
    savedGroupId,
    groups: account.groups,
  });
});

const columnMappingSchema = z.object({
  dateColumn: z.string().min(1),
  descriptionColumn: z.string().min(1),
  amountColumn: z.string().optional(),
  debitColumn: z.string().optional(),
  creditColumn: z.string().optional(),
  invertAmount: z.boolean().optional(),
  dateFormat: z.enum(["DMY", "MDY", "YMD"]).optional(),
});

const confirmSchema = z.object({
  fileContent: z.string().min(1),
  filename: z.string().default("statement.csv"),
  mapping: columnMappingSchema,
  groupId: z.string().min(1),
  applyRules: z.boolean().default(true),
});

importsRouter.post("/:accountId/confirm", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { fileContent, filename, mapping, groupId, applyRules } = parsed.data;
  const accountId = req.params.accountId;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.accountId !== accountId) {
    return res.status(400).json({ error: "Group does not belong to this account" });
  }

  const { rows } = parseCsv(fileContent);
  const { rows: normalized, invalid } = normalizeRows(rows, mapping as ColumnMapping);
  if (normalized.length === 0) {
    const invalidDates = invalid.filter((r) => r.reason === "invalid_date").length;
    const missingDescriptions = invalid.filter((r) => r.reason === "missing_description").length;
    return res.status(400).json({
      error:
        `None of the ${rows.length} row(s) could be read with this column mapping ` +
        `(${invalidDates} had a date we couldn't parse, ${missingDescriptions} had no description). ` +
        `Check the date format and column selections.`,
      invalidRowCount: invalid.length,
      invalidSamples: invalid.slice(0, 5),
    });
  }

  const result = await commitImportRows({
    accountId,
    groupId,
    filename,
    totalCount: rows.length,
    rows: normalized,
    invalid,
    applyRules,
  });

  await prisma.account.update({
    where: { id: accountId },
    data: { lastImportMapping: JSON.stringify(mapping), lastImportGroupId: groupId },
  });

  res.status(201).json(result);
});

const indmoneyPreviewSchema = z.object({
  jsonText: z.string().min(1),
});

importsRouter.post("/:accountId/indmoney/preview", async (req, res) => {
  const parsed = indmoneyPreviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = await prisma.account.findUnique({
    where: { id: req.params.accountId },
    include: { groups: { where: { archived: false } } },
  });
  if (!account) return res.status(404).json({ error: "Account not found" });

  let result;
  try {
    result = parseIndmoneyPayload(parsed.data.jsonText);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Could not read this JSON" });
  }

  res.json({
    parsedCount: result.rows.length + result.invalid.length,
    invalidCount: result.invalid.length,
    sampleRows: result.rows.slice(0, 10),
    groups: account.groups,
  });
});

const indmoneyConfirmSchema = z.object({
  jsonText: z.string().min(1),
  groupId: z.string().min(1),
  applyRules: z.boolean().default(true),
});

importsRouter.post("/:accountId/indmoney/confirm", async (req, res) => {
  const parsed = indmoneyConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { jsonText, groupId, applyRules } = parsed.data;
  const accountId = req.params.accountId;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.accountId !== accountId) {
    return res.status(400).json({ error: "Group does not belong to this account" });
  }

  let parsedPayload;
  try {
    parsedPayload = parseIndmoneyPayload(jsonText);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Could not read this JSON" });
  }
  const { rows: normalized, invalid } = parsedPayload;
  const totalCount = normalized.length + invalid.length;

  if (normalized.length === 0) {
    return res.status(400).json({
      error: `None of the ${totalCount} transaction(s) in this file could be read.`,
      invalidRowCount: invalid.length,
      invalidSamples: invalid.slice(0, 5),
    });
  }

  const result = await commitImportRows({
    accountId,
    groupId,
    filename: "indmoney-transactions.json",
    totalCount,
    rows: normalized,
    invalid,
    applyRules,
  });

  res.status(201).json(result);
});

// Base64 inflates the raw file size by ~4/3 - 7MB raw keeps the encoded
// payload comfortably under app.ts's express.json 10mb limit.
const MAX_PDF_BYTES = 7 * 1024 * 1024;

const indmoneyPdfPreviewSchema = z.object({
  filename: z.string().default("statement.pdf"),
  data: z.string().min(1), // base64, no data: URL prefix
});

async function parsePdfUpload(data: string) {
  const size = Buffer.byteLength(data, "base64");
  if (size > MAX_PDF_BYTES) {
    throw new Error(`PDF too large (max ${MAX_PDF_BYTES / (1024 * 1024)}MB)`);
  }
  // Loaded lazily (not as a top-level import) so that if pdf-parse ever fails
  // to load in a given deployment environment - it's happened before with a
  // different dependency getting silently dropped from Vercel's serverless
  // bundle - only these two PDF-import routes break instead of the whole
  // app failing to boot (imports.ts is required from app.ts's startup path).
  let parseIndmoneyPdf: (buf: Buffer) => Promise<import("../services/csvImport").NormalizeResult>;
  try {
    ({ parseIndmoneyPdf } = await import("../services/indmoneyPdfImport"));
  } catch {
    throw new Error("PDF statement import is temporarily unavailable - try CSV or IndMoney JSON instead.");
  }
  return parseIndmoneyPdf(Buffer.from(data, "base64"));
}

importsRouter.post("/:accountId/indmoney-pdf/preview", async (req, res) => {
  const parsed = indmoneyPdfPreviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = await prisma.account.findUnique({
    where: { id: req.params.accountId },
    include: { groups: { where: { archived: false } } },
  });
  if (!account) return res.status(404).json({ error: "Account not found" });

  let result;
  try {
    result = await parsePdfUpload(parsed.data.data);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Could not read this PDF" });
  }

  res.json({
    parsedCount: result.rows.length + result.invalid.length,
    invalidCount: result.invalid.length,
    sampleRows: result.rows.slice(0, 10),
    groups: account.groups,
  });
});

const indmoneyPdfConfirmSchema = z.object({
  filename: z.string().default("statement.pdf"),
  data: z.string().min(1),
  groupId: z.string().min(1),
  applyRules: z.boolean().default(true),
});

importsRouter.post("/:accountId/indmoney-pdf/confirm", async (req, res) => {
  const parsed = indmoneyPdfConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { filename, data, groupId, applyRules } = parsed.data;
  const accountId = req.params.accountId;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.accountId !== accountId) {
    return res.status(400).json({ error: "Group does not belong to this account" });
  }

  let parsedPdf;
  try {
    parsedPdf = await parsePdfUpload(data);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Could not read this PDF" });
  }
  const { rows: normalized, invalid } = parsedPdf;
  const totalCount = normalized.length + invalid.length;

  if (normalized.length === 0) {
    return res.status(400).json({
      error: `None of the ${totalCount} transaction(s) in this statement could be read.`,
      invalidRowCount: invalid.length,
      invalidSamples: invalid.slice(0, 5),
    });
  }

  const result = await commitImportRows({
    accountId,
    groupId,
    filename,
    totalCount,
    rows: normalized,
    invalid,
    applyRules,
  });

  res.status(201).json(result);
});

importsRouter.get("/:accountId/batches", async (req, res) => {
  const batches = await prisma.importBatch.findMany({
    where: { accountId: req.params.accountId },
    orderBy: { importedAt: "desc" },
  });
  res.json(batches);
});
