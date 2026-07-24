import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: api.listAccounts });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Account> }) => api.updateAccount(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.archiveAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: { name: string; color?: string; openingBalance?: number } }) =>
      api.createGroup(accountId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Group> }) => api.updateGroup(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: api.listCategories });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createCategory, onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }) });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Category> }) => api.updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteCategory, onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }) });
}

export function useRules() {
  return useQuery({ queryKey: ["rules"], queryFn: api.listRules });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createRule, onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }) });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.CategoryRule> }) => api.updateRule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteRule, onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }) });
}

export function useApplyRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.applyRules,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useTransactions(params: api.TransactionListParams) {
  return useQuery({ queryKey: ["transactions", params], queryFn: () => api.listTransactions(params) });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Transaction> }) => api.updateTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useBulkCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionIds, categoryId }: { transactionIds: string[]; categoryId: string }) =>
      api.bulkCategorize(transactionIds, categoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useBulkMoveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionIds, groupId }: { transactionIds: string[]; groupId: string }) =>
      api.bulkMoveGroup(transactionIds, groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useBulkDeleteTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.bulkDeleteTransactions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useTransfers() {
  return useQuery({ queryKey: ["transfers"], queryFn: api.listTransfers });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateTransfer(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useBalances() {
  return useQuery({ queryKey: ["balances"], queryFn: api.getBalances });
}

export function useTrend(params: {
  period: "week" | "month" | "year";
  from?: string;
  to?: string;
  accountId?: string;
  groupId?: string | string[];
}) {
  return useQuery({ queryKey: ["trend", params], queryFn: () => api.getTrend(params) });
}

export function useBreakdown(params: {
  from?: string;
  to?: string;
  accountId?: string;
  groupId?: string | string[];
  type: "INCOME" | "EXPENSE";
}) {
  return useQuery({ queryKey: ["breakdown", params], queryFn: () => api.getBreakdown(params) });
}

export function useCategoryTrend(params: {
  from?: string;
  to?: string;
  accountId?: string;
  groupId?: string | string[];
  type: "INCOME" | "EXPENSE";
}) {
  return useQuery({ queryKey: ["categoryTrend", params], queryFn: () => api.getCategoryTrend(params) });
}

export function useAssets() {
  return useQuery({ queryKey: ["assets"], queryFn: api.listAssets });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAsset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Asset> }) => api.updateAsset(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAsset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useLiabilities() {
  return useQuery({ queryKey: ["liabilities"], queryFn: api.listLiabilities });
}

export function useCreateLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLiability,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["liabilities"] });
      qc.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useUpdateLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Liability> }) => api.updateLiability(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["liabilities"] });
      qc.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useDeleteLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteLiability,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["liabilities"] });
      qc.invalidateQueries({ queryKey: ["netWorth"] });
    },
  });
}

export function useNetWorth() {
  return useQuery({ queryKey: ["netWorth"], queryFn: api.getNetWorth });
}

export function useNetWorthTrend() {
  return useQuery({ queryKey: ["netWorthTrend"], queryFn: api.getNetWorthTrend });
}

export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: api.listGoals });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createGoal, onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }) });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Goal> }) => api.updateGoal(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.deleteGoal, onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }) });
}
