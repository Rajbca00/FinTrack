import { useMemo, useState } from "react";
import type { Category, Group, Transaction } from "../lib/api";
import { assignableCategories, getErrorMessage } from "../lib/api";
import {
  useAccounts,
  useDeleteTransaction,
  useUpdateTransaction,
  useCreateTransfer,
  useBulkCategorize,
  useBulkMoveGroup,
  useBulkDeleteTransactions,
} from "../hooks/useApi";
import { Button, Modal, Input, Select, Label } from "./ui";
import { formatDate, formatMoney, toDateInputValue } from "../lib/format";

export function TransactionTable({
  transactions,
  categories,
  groups,
  showAccountColumn,
  runningBalances,
  currency,
}: {
  transactions: Transaction[];
  categories: Category[];
  groups?: Group[];
  showAccountColumn?: boolean;
  // Only meaningful (and only passed by callers) when the list is scoped to
  // a single group - see the server's /transactions handler for why.
  runningBalances?: Record<string, number>;
  currency?: string;
}) {
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const bulkCategorize = useBulkCategorize();
  const bulkMoveGroup = useBulkMoveGroup();
  const bulkDelete = useBulkDeleteTransactions();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Transfers can't be bulk-acted on (mirrors the single-row restrictions
  // below), so they're excluded from "select all" and can't be checked.
  const selectableIds = useMemo(() => transactions.filter((t) => !t.isTransfer).map((t) => t.id), [transactions]);
  const selectedCount = selectedIds.size;
  const allSelected = selectableIds.length > 0 && selectedIds.size === selectableIds.length;

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  if (transactions.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No transactions found.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {selectedCount > 0 && (
        <BulkActionsBar
          count={selectedCount}
          categories={categories}
          groups={groups}
          onClear={clearSelection}
          onCategorize={(categoryId) => {
            bulkCategorize.mutate({ transactionIds: Array.from(selectedIds), categoryId }, { onSuccess: clearSelection });
          }}
          onMoveGroup={(groupId) => {
            bulkMoveGroup.mutate({ transactionIds: Array.from(selectedIds), groupId }, { onSuccess: clearSelection });
          }}
          onDelete={() => {
            if (!confirm(`Delete ${selectedCount} transaction(s)? This can't be undone.`)) return;
            bulkDelete.mutate(Array.from(selectedIds), { onSuccess: clearSelection });
          }}
        />
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all transactions"
                  disabled={selectableIds.length === 0}
                />
              </th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Description</th>
              {showAccountColumn && <th className="px-4 py-2 font-medium">Account</th>}
              {groups && groups.length > 1 && <th className="px-4 py-2 font-medium">Group</th>}
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Notes</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              {runningBalances && <th className="px-4 py-2 text-right font-medium">Balance</th>}
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2">
                  {!t.isTransfer && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleOne(t.id)}
                      aria-label={`Select transaction ${t.description}`}
                    />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600 dark:text-slate-300">{formatDate(t.date)}</td>
              <td className="max-w-xs px-4 py-2 text-slate-800 dark:text-slate-100">
                <div className="truncate" title={t.description}>
                  {t.description}
                </div>
              </td>
              {showAccountColumn && (
                <td className="whitespace-nowrap px-4 py-2 text-slate-600 dark:text-slate-300">{t.account?.name}</td>
              )}
              {groups && groups.length > 1 && (
                <td className="px-4 py-2">
                  <Select
                    value={t.groupId}
                    onChange={(e) => updateTransaction.mutate({ id: t.id, data: { groupId: e.target.value } })}
                    className="min-w-[9rem]"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </td>
              )}
              <td className="px-4 py-2">
                <Select
                  value={t.categoryId ?? ""}
                  onChange={(e) => updateTransaction.mutate({ id: t.id, data: { categoryId: e.target.value || null } })}
                  className="min-w-[10rem]"
                >
                  <option value="">Uncategorized</option>
                  {assignableCategories(categories).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </td>
              <td className="max-w-[12rem] px-4 py-2 text-slate-500 dark:text-slate-400">
                <div className="truncate" title={t.notes ?? ""}>
                  {t.notes ?? "—"}
                </div>
              </td>
              <td
                className={`whitespace-nowrap px-4 py-2 text-right font-medium ${
                  t.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {formatMoney(t.amount, currency)}
              </td>
              {runningBalances && (
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-600 dark:text-slate-300">
                  {runningBalances[t.id] != null ? formatMoney(runningBalances[t.id], currency) : "—"}
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <Button variant="ghost" onClick={() => setEditing(t)}>
                  Edit
                </Button>
                {!t.isTransfer && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Delete this transaction?")) deleteTransaction.mutate(t.id);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {editing && (
        <EditTransactionModal
          transaction={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateTransaction.mutate({ id: editing.id, data: patch });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function BulkActionsBar({
  count,
  categories,
  groups,
  onClear,
  onCategorize,
  onMoveGroup,
  onDelete,
}: {
  count: number;
  categories: Category[];
  groups?: Group[];
  onClear: () => void;
  onCategorize: (categoryId: string) => void;
  onMoveGroup: (groupId: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-900 dark:bg-blue-500/10">
      <span className="font-medium text-slate-700 dark:text-slate-200">{count} selected</span>
      <Select
        className="w-auto min-w-40"
        value=""
        onChange={(e) => {
          if (e.target.value) onCategorize(e.target.value);
        }}
      >
        <option value="">Categorize as…</option>
        {assignableCategories(categories).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      {groups && groups.length > 1 && (
        <Select
          className="w-auto min-w-40"
          value=""
          onChange={(e) => {
            if (e.target.value) onMoveGroup(e.target.value);
          }}
        >
          <option value="">Move to group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      )}
      <Button variant="danger" onClick={onDelete}>
        Delete
      </Button>
      <Button variant="ghost" className="ml-auto" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}

function EditTransactionModal({
  transaction,
  categories,
  onClose,
  onSave,
}: {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
  onSave: (patch: Partial<Transaction>) => void;
}) {
  const { data: accounts } = useAccounts();
  const createTransfer = useCreateTransfer();
  const deleteTransaction = useDeleteTransaction();

  const [date, setDate] = useState(toDateInputValue(transaction.date));
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? "");
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [accountId, setAccountId] = useState(transaction.accountId);
  const [groupId, setGroupId] = useState(transaction.groupId);
  const [transferToAccountId, setTransferToAccountId] = useState("");
  const [transferToGroupId, setTransferToGroupId] = useState("");

  const account = accounts?.find((a) => a.id === accountId);

  // Only a plain transaction can be converted - one that's already a transfer
  // leg has a paired counterpart that this flow doesn't know how to update,
  // so editing/deleting that pair (and moving it to a different account)
  // stays on the Transfers page.
  const convertingToTransfer =
    !transaction.isTransfer && categories.find((c) => c.id === categoryId)?.type === "TRANSFER";
  const transferToAccount = accounts?.find((a) => a.id === transferToAccountId);
  const sameAccountAndGroup = transferToAccountId === accountId && transferToGroupId === groupId;

  const saving = createTransfer.isPending || deleteTransaction.isPending;

  return (
    <Modal title="Edit transaction" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Account</Label>
          <Select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              const acc = accounts?.find((a) => a.id === e.target.value);
              setGroupId(acc?.groups.find((g) => g.isDefault)?.id ?? acc?.groups[0]?.id ?? "");
            }}
            disabled={transaction.isTransfer}
          >
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        {account && account.groups.length > 1 && (
          <div>
            <Label>Group</Label>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={transaction.isTransfer}>
              {account.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Amount (negative = money out, positive = money in)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={transaction.isTransfer} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorized</option>
            {assignableCategories(categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {convertingToTransfer && (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This will delete this transaction and record it as a transfer instead, with the account/group above as
              one leg.
            </p>
            <div>
              <Label>Transfer to account</Label>
              <Select
                value={transferToAccountId}
                onChange={(e) => {
                  setTransferToAccountId(e.target.value);
                  const acc = accounts?.find((a) => a.id === e.target.value);
                  setTransferToGroupId(acc?.groups.find((g) => g.isDefault)?.id ?? acc?.groups[0]?.id ?? "");
                }}
              >
                <option value="">Select account…</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            {transferToAccount && transferToAccount.groups.length > 1 && (
              <div>
                <Label>Transfer to group</Label>
                <Select value={transferToGroupId} onChange={(e) => setTransferToGroupId(e.target.value)}>
                  {transferToAccount.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {sameAccountAndGroup && <p className="text-xs text-red-500">Source and destination must be different.</p>}
          </>
        )}
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
        <Button
          className="mt-2"
          disabled={saving || (convertingToTransfer && (!transferToAccountId || !transferToGroupId || sameAccountAndGroup))}
          onClick={() => {
            if (convertingToTransfer) {
              const legAmount = Math.abs(Number(amount));
              const outgoing = Number(amount) < 0;
              createTransfer.mutate(
                {
                  type: "ACCOUNT_TRANSFER",
                  date: new Date(date).toISOString(),
                  amount: legAmount,
                  note: description.trim() || undefined,
                  fromAccountId: outgoing ? accountId : transferToAccountId,
                  fromGroupId: outgoing ? groupId : transferToGroupId,
                  toAccountId: outgoing ? transferToAccountId : accountId,
                  toGroupId: outgoing ? transferToGroupId : groupId,
                },
                { onSuccess: () => deleteTransaction.mutate(transaction.id, { onSuccess: onClose }) }
              );
            } else {
              onSave({
                date: new Date(date).toISOString(),
                description,
                amount: transaction.isTransfer ? undefined : Number(amount),
                categoryId: categoryId || null,
                notes: notes || null,
                accountId: transaction.isTransfer ? undefined : accountId,
                groupId: transaction.isTransfer ? undefined : groupId,
              });
            }
          }}
        >
          {saving ? "Saving…" : convertingToTransfer ? "Convert to transfer" : "Save changes"}
        </Button>
        {(createTransfer.isError || deleteTransaction.isError) && (
          <p className="text-xs text-red-500">{getErrorMessage(createTransfer.error ?? deleteTransaction.error)}</p>
        )}
      </div>
    </Modal>
  );
}
