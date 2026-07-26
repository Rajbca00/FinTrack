import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useAccounts,
  useBalances,
  useCategories,
  useTransactions,
  useTrend,
  useCreateGroup,
  useDeleteGroup,
  useUpdateAccount,
  useUpdateGroup,
} from "../hooks/useApi";
import { Card, Button, Modal, Input, Label, Badge, EmptyState, Loading, Select, StatCard } from "../components/ui";
import { ImportWizard } from "../components/ImportWizard";
import { TransactionTable } from "../components/TransactionTable";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { formatMoney } from "../lib/format";
import type { Account } from "../lib/api";

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: accounts } = useAccounts();
  const { data: balances } = useBalances();
  const { data: categories } = useCategories();
  const [showImport, setShowImport] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Account["groups"][number] | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | undefined>(undefined);
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();

  const account = accounts?.find((a) => a.id === id);
  const balance = balances?.find((b) => b.id === id);

  // A running balance needs a single group to be well-defined - when the
  // account only has one, there's nothing to pick, so use it automatically
  // rather than requiring the (nonexistent) filter chips to select it.
  const effectiveGroupId = activeGroupId ?? (account?.groups.length === 1 ? account.groups[0].id : undefined);

  const { data: trend } = useTrend({ period: "month", accountId: id, groupId: effectiveGroupId });
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | undefined>(undefined);
  // Defaults to the most recent month (the last point the trend endpoint
  // returns) - only overridden once the user actually picks a different one.
  const activeMonth = useMemo(() => {
    if (!trend || trend.length === 0) return undefined;
    return trend.find((t) => t.key === selectedMonthKey) ?? trend[trend.length - 1];
  }, [trend, selectedMonthKey]);

  // The trend endpoint's month "key" is always "yyyy-MM" - turned back into
  // a UTC date range here so picking a month actually filters the
  // transaction list below it, not just the Inflow/Outflow tiles.
  const monthRange = useMemo(() => {
    if (!activeMonth) return undefined;
    const [year, month] = activeMonth.key.split("-").map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
    return { from, to };
  }, [activeMonth]);

  const [search, setSearch] = useState("");
  const { data: txnData, isLoading } = useTransactions({
    accountId: id,
    groupId: effectiveGroupId,
    q: search || undefined,
    ...monthRange,
    pageSize: 100,
  });

  if (!account) return <Loading label="Loading account…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/accounts" className="text-xs text-ink-muted hover:underline dark:text-ink-muted">
            ← All accounts
          </Link>
          <h1 className="text-xl font-semibold text-ink">{account.name}</h1>
          <p className="text-sm text-ink-muted">
            {account.type === "BANK" ? "Bank account" : "Credit card"}
            {account.institution ? ` · ${account.institution}` : ""}
            {account.last4 ? ` · ••${account.last4}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowEditAccount(true)}>
            Edit account
          </Button>
          <Button variant="secondary" onClick={() => setShowAddGroup(true)}>
            + Add group
          </Button>
          <Button variant="secondary" onClick={() => setShowAddTransaction(true)}>
            + Add transaction
          </Button>
          <Button onClick={() => setShowImport(true)}>Import statement</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase text-ink-muted">Total balance</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(balance?.balance ?? 0, account.currency)}</p>
          {account.creditLimit != null && (
            <p className="mt-1 text-xs text-ink-muted">Credit limit {formatMoney(account.creditLimit, account.currency)}</p>
          )}
        </Card>

        {account.groups.map((g) => {
          const gb = balance?.groups.find((x) => x.id === g.id);
          return (
            <Card key={g.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge color={g.color}>{g.name}</Badge>
                <div className="flex items-center gap-2">
                  <button className="text-xs text-ink-muted hover:text-brand" onClick={() => setEditingGroup(g)}>
                    Edit
                  </button>
                  {!g.isDefault && (
                    <button
                      className="text-xs text-ink-muted hover:text-critical"
                      onClick={() => {
                        if (confirm(`Delete group "${g.name}"? It must have no transactions.`)) deleteGroup.mutate(g.id);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xl font-semibold text-ink">{formatMoney(gb?.balance ?? 0, account.currency)}</p>
              <p className="text-xs text-ink-muted">{gb?.transactionCount ?? 0} transactions</p>
            </Card>
          );
        })}
      </div>

      {account.groups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip label="All groups" active={!activeGroupId} onClick={() => setActiveGroupId(undefined)} />
          {account.groups.map((g) => (
            <FilterChip key={g.id} label={g.name} active={activeGroupId === g.id} onClick={() => setActiveGroupId(g.id)} />
          ))}
        </div>
      )}

      {trend && trend.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-secondary">Monthly view</h2>
            <Select
              value={activeMonth?.key ?? ""}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="w-auto"
            >
              {trend.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Inflow" value={formatMoney(activeMonth?.income ?? 0, account.currency)} tone="good" />
            <StatCard label="Outflow" value={formatMoney(activeMonth?.expense ?? 0, account.currency)} tone="bad" />
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-ink-secondary">Transactions</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description…"
            className="sm:w-64"
          />
        </div>
        {isLoading && <Loading />}
        {!isLoading && txnData && txnData.transactions.length === 0 && (!trend || trend.length === 0) && (
          <EmptyState
            title="Import your first statement"
            message="Upload a CSV export from your bank or card to bring in transactions, or add one manually."
            action={{ label: "Import statement", onClick: () => setShowImport(true) }}
          />
        )}
        {!isLoading && txnData && txnData.transactions.length === 0 && trend && trend.length > 0 && (
          <EmptyState title="No matching transactions" message="Try a different month or search term." />
        )}
        {!isLoading && txnData && txnData.transactions.length > 0 && (
          <TransactionTable
            transactions={txnData.transactions}
            categories={categories ?? []}
            groups={account.groups}
            runningBalances={txnData.runningBalances}
            currency={account.currency}
          />
        )}
      </div>

      {showImport && <ImportWizard accountId={account.id} groups={account.groups} onClose={() => setShowImport(false)} />}
      {showAddGroup && (
        <AddGroupModal
          onClose={() => setShowAddGroup(false)}
          onCreate={(data) => createGroup.mutate({ accountId: account.id, data })}
        />
      )}
      {showEditAccount && <EditAccountModal account={account} onClose={() => setShowEditAccount(false)} />}
      {showAddTransaction && (
        <AddTransactionModal defaultAccountId={account.id} onClose={() => setShowAddTransaction(false)} />
      )}
      {editingGroup && <EditGroupModal group={editingGroup} onClose={() => setEditingGroup(null)} />}
    </div>
  );
}

function EditAccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const updateAccount = useUpdateAccount();

  const [name, setName] = useState(account.name);
  const [institution, setInstitution] = useState(account.institution ?? "");
  const [last4, setLast4] = useState(account.last4 ?? "");
  const [currency, setCurrency] = useState(account.currency);
  const [creditLimit, setCreditLimit] = useState(account.creditLimit != null ? String(account.creditLimit) : "");

  return (
    <Modal title="Edit account" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Institution</Label>
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. ICICI" />
          </div>
          <div>
            <Label>Last 4 digits</Label>
            <Input value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="1234" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          {account.type === "CREDIT_CARD" && (
            <div>
              <Label>Credit limit</Label>
              <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
            </div>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          To change a group's starting balance, name, or color, use "Edit" on that group's card instead.
        </p>
        <Button
          className="mt-2"
          onClick={() => {
            if (!name.trim()) return;
            updateAccount.mutate({
              id: account.id,
              data: {
                name: name.trim(),
                institution: institution.trim() || null,
                last4: last4.trim() || null,
                currency: currency.trim() || "INR",
                creditLimit: account.type === "CREDIT_CARD" ? Number(creditLimit) || null : null,
              },
            });
            onClose();
          }}
        >
          Save changes
        </Button>
      </div>
    </Modal>
  );
}

function EditGroupModal({ group, onClose }: { group: Account["groups"][number]; onClose: () => void }) {
  const updateGroup = useUpdateGroup();

  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color ?? "#94a3b8");
  const [openingBalance, setOpeningBalance] = useState(String(group.openingBalance));

  return (
    <Modal title="Edit group" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Color</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-hairline-strong"
            />
          </div>
          <div>
            <Label>Starting balance</Label>
            <Input type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-2"
          disabled={!name.trim()}
          onClick={() => {
            updateGroup.mutate({
              id: group.id,
              data: { name: name.trim(), color, openingBalance: Number(openingBalance) || 0 },
            });
            onClose();
          }}
        >
          Save changes
        </Button>
      </div>
    </Modal>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-brand bg-brand text-white" : "border-hairline-strong text-ink-secondary hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function AddGroupModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; color?: string; openingBalance?: number }) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#eab308");
  const [openingBalance, setOpeningBalance] = useState("0");

  return (
    <Modal title="Add a fund / purpose group" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-muted">
          Use groups to track money for a separate purpose inside this account, e.g. a temple fund alongside your personal
          funds. Move money between groups later using Transfers → Reallocation.
        </p>
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Temple Fund" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Color</Label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-full rounded-lg border border-slate-300 dark:border-hairline-strong" />
          </div>
          <div>
            <Label>Starting balance (optional)</Label>
            <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-2"
          onClick={() => {
            if (!name.trim()) return;
            onCreate({ name: name.trim(), color, openingBalance: Number(openingBalance) || 0 });
            onClose();
          }}
        >
          Add group
        </Button>
      </div>
    </Modal>
  );
}
