import { CategoryRule } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type RuleMatchInput = {
  description: string;
  amount: number; // positive = credit, negative = debit
};

function matches(rule: CategoryRule, input: RuleMatchInput): boolean {
  if (rule.amountSign === "DEBIT" && input.amount >= 0) return false;
  if (rule.amountSign === "CREDIT" && input.amount < 0) return false;

  const desc = input.description ?? "";
  switch (rule.matchType) {
    case "EXACT":
      return desc.toLowerCase() === rule.pattern.toLowerCase();
    case "STARTS_WITH":
      return desc.toLowerCase().startsWith(rule.pattern.toLowerCase());
    case "REGEX":
      try {
        return new RegExp(rule.pattern, "i").test(desc);
      } catch {
        return false;
      }
    case "CONTAINS":
    default:
      return desc.toLowerCase().includes(rule.pattern.toLowerCase());
  }
}

let cachedRules: CategoryRule[] | null = null;
let cacheExpiresAt = 0;

export async function getActiveRules(): Promise<CategoryRule[]> {
  const now = Date.now();
  if (cachedRules && now < cacheExpiresAt) return cachedRules;
  cachedRules = await prisma.categoryRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });
  cacheExpiresAt = now + 5000;
  return cachedRules;
}

export function invalidateRuleCache() {
  cachedRules = null;
}

export type CategorizeResult = { categoryId: string; notes: string | null };

// Returns the category (and optional notes template) of the first matching
// active rule (highest priority first), or null if nothing matched.
export async function categorize(input: RuleMatchInput): Promise<CategorizeResult | null> {
  const rules = await getActiveRules();
  for (const rule of rules) {
    if (matches(rule, input)) return { categoryId: rule.categoryId, notes: rule.notes };
  }
  return null;
}
