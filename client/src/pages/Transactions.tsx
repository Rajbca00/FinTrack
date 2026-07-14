import { useMemo, useState } from "react";
import { useAccounts, useCategories, useTransactions, useApplyRules } from "../hooks/useApi";
import { TransactionTable } from "../components/TransactionTable";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { Card, Button, Select, Input, Label } from "../components/ui";
import { assignableCategories } from "../lib/api";

export function Transactions() {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const [accountId, setAccountId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const applyRules = useApplyRules();

  const selectedAccount = accounts?.find((a) => a.id === accountId);

  const { data, isLoading } = useTransactions({
    accountId: accountId || undefined,
    groupId: groupId || undefined,
    categoryId: categoryId || undefined,
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: 50,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const allGroups = useMemo(() => accounts?.flatMap((a) => a.groups) ?? [], [accounts]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Transactions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Search, filter, and edit every transaction across accounts.</p>
        </div>
        <div className="flex gap-2">
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

      <Card className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
                {g.name}
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
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label>Search</Label>
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Description contains…" />
        </div>
      </Card>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {data && (
        <>
          <TransactionTable transactions={data.transactions} categories={categories ?? []} groups={allGroups} showAccountColumn />
          <div className="flex items-center justify-between text-sm text-slate-500">
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
