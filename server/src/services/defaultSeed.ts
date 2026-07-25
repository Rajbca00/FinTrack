import type { PrismaClient } from "@prisma/client";

// Shared between the one-time CLI seed script (prisma/seed.ts) and the
// "reset app" flow, which needs to land back on this exact same default
// state - keeping the category/rule list in one place means the two can't
// silently drift apart.
type CategoryType = "INCOME" | "EXPENSE" | "TRANSFER";
type MatchType = "CONTAINS" | "STARTS_WITH" | "REGEX" | "EXACT";

export const DEFAULT_CATEGORIES: { name: string; type: CategoryType; color: string; isSystem?: boolean }[] = [
  { name: "Salary", type: "INCOME", color: "#16a34a" },
  { name: "Interest / Dividends", type: "INCOME", color: "#22c55e" },
  { name: "Other Income", type: "INCOME", color: "#4ade80" },
  { name: "Groceries", type: "EXPENSE", color: "#f97316" },
  { name: "Dining & Food Delivery", type: "EXPENSE", color: "#fb923c" },
  { name: "Transport & Fuel", type: "EXPENSE", color: "#0ea5e9" },
  { name: "Utilities", type: "EXPENSE", color: "#38bdf8" },
  { name: "Rent / EMI", type: "EXPENSE", color: "#a855f7" },
  { name: "Shopping", type: "EXPENSE", color: "#ec4899" },
  { name: "Entertainment", type: "EXPENSE", color: "#e879f9" },
  { name: "Healthcare", type: "EXPENSE", color: "#ef4444" },
  { name: "Insurance", type: "EXPENSE", color: "#f43f5e" },
  { name: "Fees & Charges", type: "EXPENSE", color: "#94a3b8" },
  { name: "Donations / Temple", type: "EXPENSE", color: "#eab308" },
  { name: "Uncategorized", type: "EXPENSE", color: "#64748b", isSystem: true },
  { name: "Internal Transfer", type: "TRANSFER", color: "#64748b", isSystem: true },
];

export const DEFAULT_RULES: { pattern: string; matchType: MatchType; category: string; amountSign?: string }[] = [
  { pattern: "salary", matchType: "CONTAINS", category: "Salary", amountSign: "CREDIT" },
  { pattern: "swiggy|zomato", matchType: "REGEX", category: "Dining & Food Delivery" },
  { pattern: "bigbasket|dmart|grocer", matchType: "REGEX", category: "Groceries" },
  { pattern: "uber|ola|irctc|fuel|petrol", matchType: "REGEX", category: "Transport & Fuel" },
  { pattern: "electricity|water bill|broadband|recharge", matchType: "REGEX", category: "Utilities" },
  { pattern: "netflix|prime video|hotstar|spotify", matchType: "REGEX", category: "Entertainment" },
  { pattern: "pharmacy|hospital|clinic|apollo", matchType: "REGEX", category: "Healthcare" },
  { pattern: "temple|donation|trust", matchType: "REGEX", category: "Donations / Temple" },
  { pattern: "amazon|flipkart|myntra", matchType: "REGEX", category: "Shopping" },
];

export async function seedDefaults(client: PrismaClient) {
  const categoryIdByName = new Map<string, string>();
  for (const c of DEFAULT_CATEGORIES) {
    const created = await client.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, type: c.type, color: c.color, isSystem: c.isSystem ?? false },
    });
    categoryIdByName.set(c.name, created.id);
  }

  for (const r of DEFAULT_RULES) {
    const categoryId = categoryIdByName.get(r.category);
    if (!categoryId) continue;
    const existing = await client.categoryRule.findFirst({ where: { pattern: r.pattern, categoryId } });
    if (existing) continue;
    await client.categoryRule.create({
      data: { pattern: r.pattern, matchType: r.matchType, categoryId, amountSign: r.amountSign ?? "ANY", priority: 0 },
    });
  }

  return { categoryCount: categoryIdByName.size, ruleCount: DEFAULT_RULES.length };
}
