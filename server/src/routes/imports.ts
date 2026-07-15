import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { parseCsv, suggestMapping, normalizeRows, detectDateFormat, ColumnMapping } from "../services/csvImport";
import { dedupeKey } from "../lib/dedupe";
import { categorize } from "../services/rulesEngine";

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
  const normalized = normalizeRows(rows, mapping as ColumnMapping);
  if (normalized.length === 0) {
    return res.status(400).json({ error: "No valid rows found with the given column mapping" });
  }

  const existingKeys = new Set(
    (
      await prisma.transaction.findMany({
        where: { accountId, dedupeKey: { not: null } },
        select: { dedupeKey: true },
      })
    ).map((t) => t.dedupeKey as string)
  );

  const batch = await prisma.importBatch.create({
    data: { accountId, filename, rowCount: normalized.length },
  });

  let created = 0;
  let skipped = 0;
  const seenThisBatch = new Set<string>();

  for (const row of normalized) {
    const key = dedupeKey(row.dateISO, row.description, row.amount);
    if (existingKeys.has(key) || seenThisBatch.has(key)) {
      skipped++;
      continue;
    }
    seenThisBatch.add(key);

    const categoryId = applyRules ? await categorize({ description: row.description, amount: row.amount }) : null;

    await prisma.transaction.create({
      data: {
        accountId,
        groupId,
        date: new Date(row.dateISO),
        description: row.description,
        rawDescription: row.description,
        amount: row.amount,
        categoryId,
        dedupeKey: key,
        importBatchId: batch.id,
      },
    });
    created++;
  }

  await prisma.importBatch.update({ where: { id: batch.id }, data: { skippedDuplicates: skipped } });
  await prisma.account.update({
    where: { id: accountId },
    data: { lastImportMapping: JSON.stringify(mapping), lastImportGroupId: groupId },
  });

  res.status(201).json({ batchId: batch.id, created, skipped, total: normalized.length });
});

importsRouter.get("/:accountId/batches", async (req, res) => {
  const batches = await prisma.importBatch.findMany({
    where: { accountId: req.params.accountId },
    orderBy: { importedAt: "desc" },
  });
  res.json(batches);
});
