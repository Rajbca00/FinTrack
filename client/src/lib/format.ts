export function formatMoney(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// Group names like "General" repeat once per account by design, so any
// dropdown that lists groups spanning more than one account needs the
// account name to disambiguate them. Groups scoped to a single
// already-selected account (no accountName attached) render unprefixed.
export function groupDisplayName(group: { name: string; accountName?: string }): string {
  return group.accountName ? `${group.accountName} - ${group.name}` : group.name;
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  FIXED_DEPOSIT: "Fixed Deposit",
  MUTUAL_FUND: "Mutual Fund",
  EPF: "EPF",
  PPF: "PPF",
  GOLD: "Gold",
  CASH: "Cash in Hand",
  REAL_ESTATE: "Real Estate",
  VEHICLE: "Vehicle",
  CRYPTO: "Cryptocurrency",
  OTHER: "Other",
};

export const LIABILITY_TYPE_LABELS: Record<string, string> = {
  HOME_LOAN: "Home Loan",
  PERSONAL_LOAN: "Personal Loan",
  GOLD_LOAN: "Gold Loan",
  VEHICLE_LOAN: "Vehicle Loan",
  CREDIT_CARD: "Credit Card",
  OTHER: "Other",
};
