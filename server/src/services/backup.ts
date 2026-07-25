import { prisma } from "../lib/prisma";
import { seedDefaults } from "./defaultSeed";

// A full snapshot of every table, in the shape needed to recreate the
// database exactly - ids are preserved (not regenerated) so relations
// resolve correctly on restore.
export async function exportAllData() {
  const [
    categories,
    accounts,
    groups,
    rules,
    assets,
    liabilities,
    goals,
    bills,
    budgets,
    importBatches,
    transfers,
    transactions,
    attachments,
    netWorthSnapshots,
  ] = await Promise.all([
    prisma.category.findMany(),
    prisma.account.findMany(),
    prisma.group.findMany(),
    prisma.categoryRule.findMany(),
    prisma.asset.findMany(),
    prisma.liability.findMany(),
    prisma.goal.findMany(),
    prisma.bill.findMany(),
    prisma.budget.findMany(),
    prisma.importBatch.findMany(),
    prisma.transfer.findMany(),
    prisma.transaction.findMany(),
    prisma.attachment.findMany(),
    prisma.netWorthSnapshot.findMany(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      categories,
      accounts,
      groups,
      rules,
      assets,
      liabilities,
      goals,
      bills,
      budgets,
      importBatches,
      transfers,
      transactions,
      attachments,
      netWorthSnapshots,
    },
  };
}

export type BackupPayload = Awaited<ReturnType<typeof exportAllData>>;

// Wipes every table and recreates it from the given export - a deliberate
// full replace (not a merge), since "restore" only makes sense as "go back
// to exactly this snapshot". Deletes children-first and recreates
// parents-first so foreign keys are always valid mid-transaction; ids are
// carried over via createMany rather than left to regenerate.
export async function importAllData(payload: BackupPayload) {
  const { data } = payload;

  await prisma.$transaction(async (tx) => {
    await tx.attachment.deleteMany();
    await tx.transaction.deleteMany();
    await tx.transfer.deleteMany();
    await tx.importBatch.deleteMany();
    await tx.budget.deleteMany();
    await tx.bill.deleteMany();
    await tx.goal.deleteMany();
    await tx.group.deleteMany();
    await tx.account.deleteMany();
    await tx.categoryRule.deleteMany();
    await tx.category.deleteMany();
    await tx.asset.deleteMany();
    await tx.liability.deleteMany();
    await tx.netWorthSnapshot.deleteMany();

    if (data.categories.length) await tx.category.createMany({ data: data.categories });
    if (data.accounts.length) await tx.account.createMany({ data: data.accounts });
    if (data.groups.length) await tx.group.createMany({ data: data.groups });
    if (data.rules.length) await tx.categoryRule.createMany({ data: data.rules });
    if (data.assets.length) await tx.asset.createMany({ data: data.assets });
    if (data.liabilities.length) await tx.liability.createMany({ data: data.liabilities });
    if (data.goals.length) await tx.goal.createMany({ data: data.goals });
    if (data.bills.length) await tx.bill.createMany({ data: data.bills });
    if (data.budgets.length) await tx.budget.createMany({ data: data.budgets });
    if (data.importBatches.length) await tx.importBatch.createMany({ data: data.importBatches });
    if (data.transfers.length) await tx.transfer.createMany({ data: data.transfers });
    if (data.transactions.length) await tx.transaction.createMany({ data: data.transactions });
    if (data.attachments.length) await tx.attachment.createMany({ data: data.attachments });
    if (data.netWorthSnapshots.length) await tx.netWorthSnapshot.createMany({ data: data.netWorthSnapshots });
  });
}

// Wipes every table - same deletion order as importAllData - then reseeds
// the default categories/rules, landing the app back on exactly the state
// it's in right after a fresh install. Unlike import, there's no backup to
// restore from afterward, so this is the more destructive of the two and
// the route calling this needs its own explicit confirmation on the client.
export async function resetAllData() {
  await prisma.$transaction(async (tx) => {
    await tx.attachment.deleteMany();
    await tx.transaction.deleteMany();
    await tx.transfer.deleteMany();
    await tx.importBatch.deleteMany();
    await tx.budget.deleteMany();
    await tx.bill.deleteMany();
    await tx.goal.deleteMany();
    await tx.group.deleteMany();
    await tx.account.deleteMany();
    await tx.categoryRule.deleteMany();
    await tx.category.deleteMany();
    await tx.asset.deleteMany();
    await tx.liability.deleteMany();
    await tx.netWorthSnapshot.deleteMany();
  });

  await seedDefaults(prisma);
}
