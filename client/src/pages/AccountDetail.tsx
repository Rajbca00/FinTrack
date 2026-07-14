import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useAccounts,
  useBalances,
  useCategories,
  useTransactions,
  useCreateGroup,
  useDeleteGroup,
  useUpdateAccount,
  useUpdateGroup,
} from "../hooks/useApi";
import { Card, Button, Modal, Input, Label, Badge } from "../components/ui";
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
  const { data: txnData, isLoading } = useTransactions({ accountId: id, groupId: effectiveGroupId, pageSize: 100 });

  if (!account) return <p className="text-sm text-slate-500">Loading account…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/accounts" className="text-xs text-slate-500 hover:underline dark:text-slate-400">
            ← All accounts
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{account.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {account.type === "BANK" ? "Bank account" : "Credit card"}
            {account.institution ? ` · ${account.institution}` : ""}
            {account.last4 ? ` · ••${account.last4}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
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
          <p className="text-xs font-medium uppercase text-slate-500">Total balance</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(balance?.balance ?? 0, account.currency)}</p>
          {account.creditLimit != null && (
            <p className="mt-1 text-xs text-slate-500">Credit limit {formatMoney(account.creditLimit, account.currency)}</p>
          )}
        </Card>

        {account.groups.map((g) => {
          const gb = balance?.groups.find((x) => x.id === g.id);
          return (
            <Card key={g.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge color={g.color}>{g.name}</Badge>
                <div className="flex items-center gap-2">
                  <button className="text-xs text-slate-400 hover:text-blue-500" onClick={() => setEditingGroup(g)}>
                    Edit
                  </button>
                  {!g.isDefault && (
                    <button
                      className="text-xs text-slate-400 hover:text-red-500"
                      onClick={() => {
                        if (confirm(`Delete group "${g.name}"? It must have no transactions.`)) deleteGroup.mutate(g.id);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(gb?.balance ?? 0, account.currency)}</p>
              <p className="text-xs text-slate-500">{gb?.transactionCount ?? 0} transactions</p>
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

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Transactions</h2>
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {!isLoading && txnData && (
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
        <p className="text-xs text-slate-500 dark:text-slate-400">
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
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700"
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
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
        <p className="text-xs text-slate-500 dark:text-slate-400">
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
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700" />
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
