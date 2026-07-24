import { startOfDay } from "date-fns";
import { prisma } from "../lib/prisma";

const INVESTMENT_TYPES = ["FIXED_DEPOSIT", "MUTUAL_FUND", "GOLD", "CRYPTO"];
const RETIREMENT_TYPES = ["EPF", "PPF"];

export type NetWorthBreakdown = {
  cashAndBank: number;
  investments: number;
  retirement: number;
  otherAssets: number;
  liabilities: number;
  netWorth: number;
};

// Bank accounts contribute their balance to Cash & Bank; credit card
// accounts are already a running ledger of what's owed, so their (negative)
// balance is folded into Liabilities alongside standalone loans rather than
// double-counted as a separate credit-card Liability row.
export async function computeNetWorth(): Promise<NetWorthBreakdown> {
  const accounts = await prisma.account.findMany({
    where: { archived: false },
    include: { groups: { where: { archived: false } } },
  });

  let cashAndBank = 0;
  let creditCardDebt = 0;
  for (const account of accounts) {
    let accountBalance = 0;
    for (const group of account.groups) {
      const agg = await prisma.transaction.aggregate({ where: { groupId: group.id }, _sum: { amount: true } });
      accountBalance += group.openingBalance + (agg._sum.amount ?? 0);
    }
    if (account.type === "CREDIT_CARD") {
      creditCardDebt += Math.max(0, -accountBalance);
    } else {
      cashAndBank += accountBalance;
    }
  }

  const assets = await prisma.asset.findMany({ where: { archived: false } });
  let investments = 0;
  let retirement = 0;
  let otherAssets = 0;
  for (const asset of assets) {
    if (INVESTMENT_TYPES.includes(asset.type)) investments += asset.currentValue;
    else if (RETIREMENT_TYPES.includes(asset.type)) retirement += asset.currentValue;
    else otherAssets += asset.currentValue;
  }

  const liabilityAgg = await prisma.liability.aggregate({
    where: { archived: false },
    _sum: { outstandingBalance: true },
  });
  const liabilities = (liabilityAgg._sum.outstandingBalance ?? 0) + creditCardDebt;

  const netWorth = cashAndBank + investments + retirement + otherAssets - liabilities;

  return { cashAndBank, investments, retirement, otherAssets, liabilities, netWorth };
}

// Upserts today's snapshot on every read so the trend chart accumulates
// history organically - no cron needed, and a re-fetch the same day just
// refreshes today's row instead of creating duplicates.
export async function recordSnapshot(breakdown: NetWorthBreakdown) {
  const date = startOfDay(new Date());
  await prisma.netWorthSnapshot.upsert({
    where: { date },
    create: { date, ...breakdown },
    update: { ...breakdown },
  });
}

export async function getNetWorthTrend(limit = 180) {
  const snapshots = await prisma.netWorthSnapshot.findMany({
    orderBy: { date: "asc" },
    take: limit,
  });
  return snapshots.map((s) => ({
    date: s.date.toISOString(),
    cashAndBank: s.cashAndBank,
    investments: s.investments,
    retirement: s.retirement,
    otherAssets: s.otherAssets,
    liabilities: s.liabilities,
    netWorth: s.netWorth,
  }));
}
