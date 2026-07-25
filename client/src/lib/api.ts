import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

// Route handlers respond with either a plain string error (e.g. "Source and
// destination must differ") or a zod .flatten() shape ({ formErrors,
// fieldErrors }) on 400s. Mutations otherwise fail silently - React Query
// just stores the error, nothing renders it - so every submit handler that
// shows errors to the user should format them through this.
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown } | undefined;
    const err = data?.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const messages = [
        ...(flat.formErrors ?? []),
        ...Object.entries(flat.fieldErrors ?? {}).flatMap(([field, msgs]) => (msgs ?? []).map((m) => `${field}: ${m}`)),
      ];
      if (messages.length > 0) return messages.join("; ");
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

export type AccountType = "BANK" | "CREDIT_CARD";
export type CategoryType = "INCOME" | "EXPENSE" | "TRANSFER";
export type MatchType = "CONTAINS" | "STARTS_WITH" | "REGEX" | "EXACT";
export type AmountSign = "ANY" | "DEBIT" | "CREDIT";
export type TransferType = "ACCOUNT_TRANSFER" | "GROUP_REALLOCATION";

export type Group = {
  id: string;
  name: string;
  color: string | null;
  accountId: string;
  isDefault: boolean;
  openingBalance: number;
  archived: boolean;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  last4: string | null;
  currency: string;
  creditLimit: number | null;
  isMultiPurpose: boolean;
  archived: boolean;
  groups: Group[];
};

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
  parentId: string | null;
  _count?: { transactions: number; rules: number };
};

// The seeded system "Uncategorized" category is never actually assigned to a
// transaction - rule matching and the "no category" state both use
// categoryId: null (see server/src/services/rulesEngine.ts and
// summary.ts's `t.category?.name ?? "Uncategorized"` fallback). Listing it
// in an assignment picker just creates a second, non-functional
// "Uncategorized" entry next to the real null-based one, so every picker
// that assigns a category to something filters it out with this helper.
export const assignableCategories = (categories: Category[] | undefined) =>
  categories?.filter((c) => c.name !== "Uncategorized") ?? [];

export type CategoryRule = {
  id: string;
  pattern: string;
  matchType: MatchType;
  amountSign: AmountSign;
  priority: number;
  isActive: boolean;
  categoryId: string;
  category?: Category;
};

export type Transaction = {
  id: string;
  accountId: string;
  groupId: string;
  date: string;
  description: string;
  rawDescription: string | null;
  amount: number;
  categoryId: string | null;
  notes: string | null;
  isTransfer: boolean;
  transferId: string | null;
  category?: Category | null;
  group?: Group;
  account?: Account;
};

export type Transfer = {
  id: string;
  type: TransferType;
  date: string;
  amount: number;
  note: string | null;
  transactions: Transaction[];
};

export type AccountBalance = {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  last4: string | null;
  currency: string;
  creditLimit: number | null;
  isMultiPurpose: boolean;
  balance: number;
  groups: {
    id: string;
    name: string;
    color: string | null;
    isDefault: boolean;
    openingBalance: number;
    balance: number;
    transactionCount: number;
  }[];
};

export type TrendPoint = { key: string; label: string; income: number; expense: number; net: number };
export type BreakdownPoint = { categoryId: string; name: string; color: string | null; total: number };

// --- Accounts ---
export const listAccounts = () => api.get<Account[]>("/accounts").then((r) => r.data);
export const createAccount = (data: Partial<Account> & { openingBalance?: number }) =>
  api.post<Account>("/accounts", data).then((r) => r.data);
export const updateAccount = (id: string, data: Partial<Account>) =>
  api.put<Account>(`/accounts/${id}`, data).then((r) => r.data);
export const archiveAccount = (id: string) => api.delete(`/accounts/${id}`);

// --- Groups ---
export const createGroup = (accountId: string, data: { name: string; color?: string; openingBalance?: number }) =>
  api.post<Group>(`/accounts/${accountId}/groups`, data).then((r) => r.data);
export const updateGroup = (id: string, data: Partial<Group>) => api.put<Group>(`/groups/${id}`, data).then((r) => r.data);
export const deleteGroup = (id: string) => api.delete(`/groups/${id}`);

// --- Categories ---
export const listCategories = () => api.get<Category[]>("/categories").then((r) => r.data);
export const createCategory = (data: { name: string; type: CategoryType; color?: string; parentId?: string | null }) =>
  api.post<Category>("/categories", data).then((r) => r.data);
export const updateCategory = (id: string, data: Partial<Category>) =>
  api.put<Category>(`/categories/${id}`, data).then((r) => r.data);
export const deleteCategory = (id: string) => api.delete(`/categories/${id}`);

// --- Rules ---
export const listRules = () => api.get<CategoryRule[]>("/rules").then((r) => r.data);
export const createRule = (data: Partial<CategoryRule>) => api.post<CategoryRule>("/rules", data).then((r) => r.data);
export const updateRule = (id: string, data: Partial<CategoryRule>) =>
  api.put<CategoryRule>(`/rules/${id}`, data).then((r) => r.data);
export const deleteRule = (id: string) => api.delete(`/rules/${id}`);
export const applyRules = (opts: { accountId?: string; overwrite?: boolean }) =>
  api.post<{ scanned: number; updated: number }>("/rules/apply", opts).then((r) => r.data);

// --- Transactions ---
export type TransactionListParams = {
  accountId?: string;
  groupId?: string;
  categoryId?: string;
  type?: "INCOME" | "EXPENSE";
  from?: string;
  to?: string;
  q?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
};
export const listTransactions = (params: TransactionListParams) =>
  api
    .get<{ total: number; page: number; pageSize: number; transactions: Transaction[]; runningBalances?: Record<string, number> }>(
      "/transactions",
      { params }
    )
    .then((r) => r.data);
export const createTransaction = (data: Partial<Transaction>) =>
  api.post<Transaction>("/transactions", data).then((r) => r.data);
export const updateTransaction = (id: string, data: Partial<Transaction>) =>
  api.put<Transaction>(`/transactions/${id}`, data).then((r) => r.data);
export const deleteTransaction = (id: string) => api.delete(`/transactions/${id}`);
export const bulkCategorize = (transactionIds: string[], categoryId: string) =>
  api.post("/transactions/bulk-categorize", { transactionIds, categoryId });
export const bulkMoveGroup = (transactionIds: string[], groupId: string) =>
  api.post("/transactions/bulk-move-group", { transactionIds, groupId });
export const bulkDeleteTransactions = (transactionIds: string[]) =>
  api.post<{ deleted: number }>("/transactions/bulk-delete", { transactionIds }).then((r) => r.data);

// --- Import ---
export type ImportPreview = {
  headers: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
  suggestedMapping: {
    dateColumn: string | null;
    descriptionColumn: string | null;
    debitColumn: string | null;
    creditColumn: string | null;
    amountColumn: string | null;
  };
  // The mapping (and target group) used the last time this account was imported into,
  // returned only when it's still valid for this file's actual headers.
  savedMapping: ColumnMapping | null;
  savedGroupId: string | null;
  groups: Group[];
  // Best guess at day-first vs month-first, from scanning every date value in
  // the file for one that's unambiguous (e.g. day > 12) - falls back to "DMY"
  // when the file never disambiguates itself.
  suggestedDateFormat: DateFormat;
};
export const previewImport = (accountId: string, fileContent: string, filename: string) =>
  api.post<ImportPreview>(`/import/${accountId}/preview`, { fileContent, filename }).then((r) => r.data);

// Which position the day falls in for ambiguous slash/dash dates like
// "07/10/2026" - there's no way to tell from a single value, so this has to
// come from the user (auto-detected where possible, else picked manually).
export type DateFormat = "DMY" | "MDY" | "YMD";

export type ColumnMapping = {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  invertAmount?: boolean;
  dateFormat?: DateFormat;
};
export type InvalidImportRow = {
  rowIndex: number;
  reason: "invalid_date" | "missing_description" | "invalid_amount";
  dateRaw: string;
  descriptionRaw: string;
};

export type ImportResult = {
  batchId: string;
  created: number;
  skipped: number;
  total: number;
  invalidRowCount: number;
  invalidSamples: InvalidImportRow[];
};

export const confirmImport = (
  accountId: string,
  payload: { fileContent: string; filename: string; mapping: ColumnMapping; groupId: string; applyRules: boolean }
) => api.post<ImportResult>(`/import/${accountId}/confirm`, payload).then((r) => r.data);

// --- IndMoney JSON import ---
// A parallel import source to CSV: paste the JSON payload from IndMoney's
// Account Aggregator "All Transactions" screen instead of exporting/uploading
// a bank statement file. No column mapping needed - the shape is fixed and
// parsed entirely server-side (see server/src/services/indmoneyImport.ts).
export type IndmoneySampleRow = { dateISO: string; description: string; amount: number };
export type IndmoneyPreview = {
  parsedCount: number;
  invalidCount: number;
  sampleRows: IndmoneySampleRow[];
  groups: Group[];
};
export const previewIndmoneyImport = (accountId: string, jsonText: string) =>
  api.post<IndmoneyPreview>(`/import/${accountId}/indmoney/preview`, { jsonText }).then((r) => r.data);
export const confirmIndmoneyImport = (accountId: string, payload: { jsonText: string; groupId: string; applyRules: boolean }) =>
  api.post<ImportResult>(`/import/${accountId}/indmoney/confirm`, payload).then((r) => r.data);

// --- IndMoney PDF statement import ---
// A third import source: IndMoney's "Account Statement" PDF export (richer
// than the JSON source - it carries the bank's actual narration text, which
// the app-screen JSON doesn't expose). Uploaded as base64, same pattern as
// attachments - see server/src/services/indmoneyPdfImport.ts.
export const previewIndmoneyPdfImport = (accountId: string, payload: { filename: string; data: string }) =>
  api.post<IndmoneyPreview>(`/import/${accountId}/indmoney-pdf/preview`, payload).then((r) => r.data);
export const confirmIndmoneyPdfImport = (
  accountId: string,
  payload: { filename: string; data: string; groupId: string; applyRules: boolean }
) => api.post<ImportResult>(`/import/${accountId}/indmoney-pdf/confirm`, payload).then((r) => r.data);

// --- Transfers ---
export const listTransfers = () => api.get<Transfer[]>("/transfers").then((r) => r.data);
export const createTransfer = (data: Record<string, unknown>) => api.post<Transfer>("/transfers", data).then((r) => r.data);
export const updateTransfer = (id: string, data: Record<string, unknown>) =>
  api.put<Transfer>(`/transfers/${id}`, data).then((r) => r.data);
export const deleteTransfer = (id: string) => api.delete(`/transfers/${id}`);

// --- Summary ---
// groupId accepts an array to filter by every group matching a name across
// accounts (e.g. all "General" groups) - axios serializes it as repeated
// query keys, which Express parses back into an array.
export const getTrend = (params: {
  period: "week" | "month" | "year";
  from?: string;
  to?: string;
  accountId?: string;
  groupId?: string | string[];
}) => api.get<TrendPoint[]>("/summary/trend", { params }).then((r) => r.data);
export const getBreakdown = (params: {
  period?: "week" | "month" | "year";
  from?: string;
  to?: string;
  accountId?: string;
  groupId?: string | string[];
  type: "INCOME" | "EXPENSE";
}) => api.get<BreakdownPoint[]>("/summary/breakdown", { params }).then((r) => r.data);
export const getBalances = () => api.get<AccountBalance[]>("/summary/balances").then((r) => r.data);

// --- Assets ---
export type AssetType =
  | "FIXED_DEPOSIT"
  | "MUTUAL_FUND"
  | "EPF"
  | "PPF"
  | "GOLD"
  | "CASH"
  | "REAL_ESTATE"
  | "VEHICLE"
  | "CRYPTO"
  | "OTHER";

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  currentValue: number;
  purchaseValue: number | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export const listAssets = () => api.get<Asset[]>("/assets").then((r) => r.data);
export const createAsset = (data: Partial<Asset>) => api.post<Asset>("/assets", data).then((r) => r.data);
export const updateAsset = (id: string, data: Partial<Asset>) => api.put<Asset>(`/assets/${id}`, data).then((r) => r.data);
export const deleteAsset = (id: string) => api.delete(`/assets/${id}`);

// --- Liabilities ---
export type LiabilityType = "HOME_LOAN" | "PERSONAL_LOAN" | "GOLD_LOAN" | "VEHICLE_LOAN" | "CREDIT_CARD" | "OTHER";

export type Liability = {
  id: string;
  name: string;
  type: LiabilityType;
  outstandingBalance: number;
  interestRate: number | null;
  emiAmount: number | null;
  nextDueDate: string | null;
  lender: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export const listLiabilities = () => api.get<Liability[]>("/liabilities").then((r) => r.data);
export const createLiability = (data: Partial<Liability>) => api.post<Liability>("/liabilities", data).then((r) => r.data);
export const updateLiability = (id: string, data: Partial<Liability>) =>
  api.put<Liability>(`/liabilities/${id}`, data).then((r) => r.data);
export const deleteLiability = (id: string) => api.delete(`/liabilities/${id}`);

// --- Net worth ---
export type NetWorthBreakdown = {
  cashAndBank: number;
  investments: number;
  retirement: number;
  otherAssets: number;
  liabilities: number;
  netWorth: number;
};
export type NetWorthTrendPoint = NetWorthBreakdown & { date: string };

export const getNetWorth = () => api.get<NetWorthBreakdown>("/summary/net-worth").then((r) => r.data);
export const getNetWorthTrend = () => api.get<NetWorthTrendPoint[]>("/summary/net-worth/trend").then((r) => r.data);

// --- Goals ---
export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  linkedAccountId: string | null;
  linkedAccount?: Account | null;
  linkedAssetId: string | null;
  linkedAsset?: Asset | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export const listGoals = () => api.get<Goal[]>("/goals").then((r) => r.data);
export const createGoal = (data: Partial<Goal>) => api.post<Goal>("/goals", data).then((r) => r.data);
export const updateGoal = (id: string, data: Partial<Goal>) => api.put<Goal>(`/goals/${id}`, data).then((r) => r.data);
export const deleteGoal = (id: string) => api.delete(`/goals/${id}`);

// --- Budgets ---
export type BudgetPeriod = "MONTHLY" | "QUARTERLY" | "YEARLY";

export type Budget = {
  id: string;
  categoryId: string;
  category?: Category;
  amount: number;
  period: BudgetPeriod;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  spent: number;
  periodStart: string;
  periodEnd: string;
};

export const listBudgets = () => api.get<Budget[]>("/budgets").then((r) => r.data);
export const createBudget = (data: { categoryId: string; amount: number; period: BudgetPeriod }) =>
  api.post<Budget>("/budgets", data).then((r) => r.data);
export const updateBudget = (id: string, data: Partial<{ categoryId: string; amount: number; period: BudgetPeriod }>) =>
  api.put<Budget>(`/budgets/${id}`, data).then((r) => r.data);
export const deleteBudget = (id: string) => api.delete(`/budgets/${id}`);

// --- Bills ---
export type BillRecurrence = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export type Bill = {
  id: string;
  name: string;
  amount: number;
  categoryId: string | null;
  category?: Category | null;
  nextDueDate: string;
  recurrence: BillRecurrence;
  autoDetected: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BillGroups = { dueToday: Bill[]; dueThisWeek: Bill[]; dueThisMonth: Bill[]; later: Bill[] };

export const listBills = () => api.get<{ bills: Bill[]; groups: BillGroups }>("/bills").then((r) => r.data);
export const createBill = (data: Partial<Bill>) => api.post<Bill>("/bills", data).then((r) => r.data);
export const updateBill = (id: string, data: Partial<Bill>) => api.put<Bill>(`/bills/${id}`, data).then((r) => r.data);
export const deleteBill = (id: string) => api.delete(`/bills/${id}`);

export type BillSuggestion = {
  description: string;
  amount: number;
  occurrences: number;
  categoryId: string | null;
  suggestedNextDueDate: string;
};
export const getBillSuggestions = () => api.get<BillSuggestion[]>("/bills/suggestions").then((r) => r.data);

// --- Merchant intelligence ---
export type MerchantSuggestion = {
  categoryId: string | null;
  accountId: string | null;
  groupId: string | null;
  matchCount: number;
} | null;

export const suggestMerchant = (q: string) => api.get<MerchantSuggestion>("/merchants/suggest", { params: { q } }).then((r) => r.data);

export type MerchantStat = { name: string; count: number; total: number };
export type MerchantIntelligence = {
  topMerchants: MerchantStat[];
  topCategories: (MerchantStat & { color: string | null })[];
  topExpenses: MerchantStat[];
};
export const getMerchantIntelligence = () => api.get<MerchantIntelligence>("/merchants/top").then((r) => r.data);

export type SimilarTransaction = {
  id: string;
  description: string;
  date: string;
  amount: number;
  categoryId: string | null;
};
export const getSimilarTransactions = (transactionId: string, categoryId: string) =>
  api
    .get<{ count: number; transactions: SimilarTransaction[] }>(`/transactions/${transactionId}/similar`, { params: { categoryId } })
    .then((r) => r.data);

// --- Attachments ---
export type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
};
export type AttachmentWithData = Attachment & { data: string };

export const listAttachments = (transactionId: string) =>
  api.get<Attachment[]>(`/transactions/${transactionId}/attachments`).then((r) => r.data);
export const uploadAttachment = (transactionId: string, data: { filename: string; mimeType: string; data: string }) =>
  api.post<Attachment>(`/transactions/${transactionId}/attachments`, data).then((r) => r.data);
export const getAttachment = (id: string) => api.get<AttachmentWithData>(`/attachments/${id}`).then((r) => r.data);
export const deleteAttachment = (id: string) => api.delete(`/attachments/${id}`);

// --- Settings / backup ---
export const exportData = () => api.get<Record<string, unknown>>("/settings/export").then((r) => r.data);
export const importData = (payload: Record<string, unknown>) => api.post("/settings/import", payload);

export type CategoryTrendMonth = { key: string; label: string };
export type CategoryTrendRow = { categoryId: string; name: string; color: string | null; totals: number[]; total: number };
export const getCategoryTrend = (params: {
  from?: string;
  to?: string;
  accountId?: string;
  groupId?: string | string[];
  type: "INCOME" | "EXPENSE";
}) =>
  api
    .get<{ months: CategoryTrendMonth[]; rows: CategoryTrendRow[] }>("/summary/category-trend", { params })
    .then((r) => r.data);
