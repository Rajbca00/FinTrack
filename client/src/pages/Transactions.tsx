import { useMemo, useState } from "react";
import { useAccounts, useCategories, useTransactions, useApplyRules } from "../hooks/useApi";
import { usePersistentState } from "../hooks/usePersistentState";
import { TransactionTable } from "../components/TransactionTable";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { Card, Button, Select, Input, Label, Loading } from "../components/ui";
import { assignableCategories } from "../lib/api";
import { groupDisplayName } from "../lib/format";
import { parseSearchQuery } from "../lib/search";

export function Transactions() {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  // Filters persist across reloads/navigation (see usePersistentState) so
  // coming back to this page doesn't silently drop what you were looking at.
  const [accountId, setAccountId] = usePersistentState("fintrack.transactions.accountId", "");
  const [groupId, setGroupId] = usePersistentState("fintrack.transactions.groupId", "");
  const [categoryId, setCategoryId] = usePersistentState("fintrack.transactions.categoryId", "");
  const [type, setType] = usePersistentState<"" | "INCOME" | "EXPENSE">("fintrack.transactions.type", "");
  const [q, setQ] = usePersistentState("fintrack.transactions.q", "");
  const [from, setFrom] = usePersistentState("fintrack.transactions.from", "");
  const [to, setTo] = usePersistentState("fintrack.transactions.to", "");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const applyRules = useApplyRules();

  const selectedAccount = accounts?.find((a) => a.id === accountId);

  // The search box supports natural language ("fuel last month", "groceries
  // above 1000") on top of the explicit filters below - explicit From/To
  // date pickers win over a parsed date phrase if the user has set both,
  // since that's a deliberate, visible choice rather than a typed guess.
  const parsedSearch = useMemo(() => parseSearchQuery(q), [q]);

  const { data, isLoading } = useTransactions({
    accountId: accountId || undefined,
    groupId: groupId || undefined,
    categoryId: categoryId || undefined,
    type: type || undefined,
    q: parsedSearch.text || undefined,
    from: from || parsedSearch.from || undefined,
    to: to || parsedSearch.to || undefined,
    minAmount: parsedSearch.minAmount,
    maxAmount: parsedSearch.maxAmount,
    page,
    pageSize: 50,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const allGroups = useMemo(
    () => accounts?.flatMap((a) => a.groups.map((g) => ({ ...g, accountName: a.name }))) ?? [],
    [accounts]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Transactions</h1>
          <p className="text-sm text-ink-muted">Search, filter, and edit every transaction across accounts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => applyRules.mutate({ overwrite: false })}
            disabled={applyRules.isPending}
          >
            {applyRules.isPending ? "Applying rules…" : "Re-run auto-categorization"}
          </Button>
          <Button onClick={() => setShowAdd(true)}>+ Add transaction</Button>
        </div>
      </div>

      <Card className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <div>
          <Label>Account</Label>
          <Select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setGroupId("");
              setPage(1);
            }}
          >
            <option value="">All accounts</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Group</Label>
          <Select value={groupId} onChange={(e) => { setGroupId(e.target.value); setPage(1); }}>
            <option value="">All groups</option>
            {(selectedAccount ? selectedAccount.groups : allGroups).map((g) => (
              <option key={g.id} value={g.id}>
                {groupDisplayName(g)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {assignableCategories(categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(1); }}>
            <option value="">Income & expense</option>
            <option value="INCOME">Income only</option>
            <option value="EXPENSE">Expense only</option>
          </Select>
        </div>
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label>Search</Label>
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder='Try "fuel last month" or "groceries above 1000"'
          />
          {parsedSearch.recognized.length > 0 && (
            <p className="mt-1 text-xs text-ink-muted">Understood: {parsedSearch.recognized.join(", ")}</p>
          )}
        </div>
      </Card>

      {isLoading && <Loading />}
      {data && (
        <>
          <TransactionTable
            transactions={data.transactions}
            categories={categories ?? []}
            groups={allGroups}
            showAccountColumn
            runningBalances={data.runningBalances}
            currency={selectedAccount?.currency}
          />
          <div className="flex flex-col gap-2 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <span>
              {data.total} transaction(s) · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
