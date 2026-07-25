import { prisma } from "../lib/prisma";

function mostFrequent<T extends string>(values: (T | null)[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) {
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export type MerchantSuggestion = {
  categoryId: string | null;
  accountId: string | null;
  groupId: string | null;
  matchCount: number;
};

// Looks at every past transaction whose description contains the query
// (case-insensitive) and returns whichever category/account/group appeared
// most often among them - e.g. typing "amazon" surfaces "Shopping" because
// that's what past Amazon transactions were mostly categorized as.
export async function suggestForDescription(query: string): Promise<MerchantSuggestion | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const matches = await prisma.transaction.findMany({
    where: { description: { contains: q, mode: "insensitive" }, isTransfer: false },
    select: { categoryId: true, accountId: true, groupId: true },
    orderBy: { date: "desc" },
    take: 200,
  });
  if (matches.length === 0) return null;

  return {
    categoryId: mostFrequent(matches.map((m) => m.categoryId)),
    accountId: mostFrequent(matches.map((m) => m.accountId)),
    groupId: mostFrequent(matches.map((m) => m.groupId)),
    matchCount: matches.length,
  };
}

export type SimilarTransaction = {
  id: string;
  description: string;
  date: Date;
  amount: number;
  categoryId: string | null;
};

// Surfaces other transactions worth re-categorizing (or ruling) alongside
// the one that was just manually categorized - same substring-match logic
// as suggestForDescription, but returns the actual rows instead of an
// aggregate, since the caller needs real ids to bulk-apply a category to.
// Excludes rows already in the target category so the count reflects only
// what would actually change.
export async function findSimilarTransactions(opts: {
  transactionId: string;
  description: string;
  targetCategoryId: string;
  limit?: number;
}): Promise<SimilarTransaction[]> {
  const q = opts.description.trim();
  if (q.length < 2) return [];

  return prisma.transaction.findMany({
    where: {
      id: { not: opts.transactionId },
      description: { contains: q, mode: "insensitive" },
      isTransfer: false,
      // `categoryId: { not: X }` alone would silently exclude uncategorized
      // rows too - SQL's `NULL <> X` is NULL, not true, so those never match
      // a plain "not equal" filter. OR in the null case explicitly.
      OR: [{ categoryId: null }, { categoryId: { not: opts.targetCategoryId } }],
    },
    select: { id: true, description: true, date: true, amount: true, categoryId: true },
    orderBy: { date: "desc" },
    take: opts.limit ?? 20,
  });
}

export async function getMerchantIntelligence(limit = 8) {
  const txns = await prisma.transaction.findMany({
    where: { isTransfer: false, amount: { lt: 0 } },
    select: { description: true, amount: true, categoryId: true, category: { select: { name: true, color: true } } },
  });

  const merchantTotals = new Map<string, { name: string; count: number; total: number }>();
  const categoryTotals = new Map<string, { name: string; color: string | null; count: number; total: number }>();

  for (const t of txns) {
    const key = t.description.trim().toLowerCase();
    if (key) {
      const m = merchantTotals.get(key) ?? { name: t.description.trim(), count: 0, total: 0 };
      m.count += 1;
      m.total += Math.abs(t.amount);
      merchantTotals.set(key, m);
    }

    const catKey = t.categoryId ?? "uncategorized";
    const catName = t.category?.name ?? "Uncategorized";
    const c = categoryTotals.get(catKey) ?? { name: catName, color: t.category?.color ?? null, count: 0, total: 0 };
    c.count += 1;
    c.total += Math.abs(t.amount);
    categoryTotals.set(catKey, c);
  }

  const topMerchants = Array.from(merchantTotals.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const topCategories = Array.from(categoryTotals.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const topExpenses = Array.from(merchantTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return { topMerchants, topCategories, topExpenses };
}
