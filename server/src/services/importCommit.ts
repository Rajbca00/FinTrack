import { prisma } from "../lib/prisma";
import { dedupeKey } from "../lib/dedupe";
import { categorize } from "./rulesEngine";
import type { NormalizedRow, InvalidRow } from "./csvImport";

export type CommitResult = {
  batchId: string;
  created: number;
  skipped: number;
  total: number;
  invalidRowCount: number;
  invalidSamples: InvalidRow[];
};

// Shared by every import source (CSV, IndMoney JSON, ...) once each has
// produced the same NormalizedRow[]/InvalidRow[] shape - dedupe, rule-based
// categorization, and ImportBatch bookkeeping only need to be written once.
export async function commitImportRows(opts: {
  accountId: string;
  groupId: string;
  filename: string;
  totalCount: number;
  rows: NormalizedRow[];
  invalid: InvalidRow[];
  applyRules: boolean;
}): Promise<CommitResult> {
  const { accountId, groupId, filename, totalCount, rows, invalid, applyRules } = opts;

  const existingKeys = new Set(
    (
      await prisma.transaction.findMany({
        where: { accountId, dedupeKey: { not: null } },
        select: { dedupeKey: true },
      })
    ).map((t) => t.dedupeKey as string)
  );

  const batch = await prisma.importBatch.create({ data: { accountId, filename, rowCount: totalCount } });

  let created = 0;
  let skipped = 0;
  const seenThisBatch = new Set<string>();

  for (const row of rows) {
    const key = dedupeKey(row.dateISO, row.description, row.amount);
    if (existingKeys.has(key) || seenThisBatch.has(key)) {
      skipped++;
      continue;
    }
    seenThisBatch.add(key);

    const ruleMatch = applyRules ? await categorize({ description: row.description, amount: row.amount }) : null;

    await prisma.transaction.create({
      data: {
        accountId,
        groupId,
        date: new Date(row.dateISO),
        description: row.description,
        rawDescription: row.description,
        amount: row.amount,
        categoryId: ruleMatch?.categoryId ?? null,
        notes: ruleMatch?.notes ?? null,
        dedupeKey: key,
        importBatchId: batch.id,
      },
    });
    created++;
  }

  await prisma.importBatch.update({ where: { id: batch.id }, data: { skippedDuplicates: skipped } });

  return {
    batchId: batch.id,
    created,
    skipped,
    total: totalCount,
    invalidRowCount: invalid.length,
    invalidSamples: invalid.slice(0, 5),
  };
}
