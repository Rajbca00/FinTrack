import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

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
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};
export const listTransactions = (params: TransactionListParams) =>
  api.get<{ total: number; page: number; pageSize: number; transactions: Transaction[] }>("/transactions", { params }).then((r) => r.data);
export const createTransaction = (data: Partial<Transaction>) =>
  api.post<Transaction>("/transactions", data).then((r) => r.data);
export const updateTransaction = (id: string, data: Partial<Transaction>) =>
  api.put<Transaction>(`/transactions/${id}`, data).then((r) => r.data);
export const deleteTransaction = (id: string) => api.delete(`/transactions/${id}`);
export const bulkCategorize = (transactionIds: string[], categoryId: string) =>
  api.post("/transactions/bulk-categorize", { transactionIds, categoryId });

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
  groups: Group[];
};
export const previewImport = (accountId: string, fileContent: string, filename: string) =>
  api.post<ImportPreview>(`/import/${accountId}/preview`, { fileContent, filename }).then((r) => r.data);

export type ColumnMapping = {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  invertAmount?: boolean;
};
export const confirmImport = (
  accountId: string,
  payload: { fileContent: string; filename: string; mapping: ColumnMapping; groupId: string; applyRules: boolean }
) => api.post<{ batchId: string; created: number; skipped: number; total: number }>(`/import/${accountId}/confirm`, payload).then((r) => r.data);

// --- Transfers ---
export const listTransfers = () => api.get<Transfer[]>("/transfers").then((r) => r.data);
export const createTransfer = (data: Record<string, unknown>) => api.post<Transfer>("/transfers", data).then((r) => r.data);
export const deleteTransfer = (id: string) => api.delete(`/transfers/${id}`);

// --- Summary ---
export const getTrend = (params: { period: "week" | "month" | "year"; from?: string; to?: string; accountId?: string; groupId?: string }) =>
  api.get<TrendPoint[]>("/summary/trend", { params }).then((r) => r.data);
export const getBreakdown = (params: {
  period?: "week" | "month" | "year";
  from?: string;
  to?: string;
  accountId?: string;
  groupId?: string;
  type: "INCOME" | "EXPENSE";
}) => api.get<BreakdownPoint[]>("/summary/breakdown", { params }).then((r) => r.data);
export const getBalances = () => api.get<AccountBalance[]>("/summary/balances").then((r) => r.data);
