import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Group, SimilarTransaction, Transaction } from "../lib/api";
import { assignableCategories, getErrorMessage, getSimilarTransactions } from "../lib/api";
import {
  useAccounts,
  useDeleteTransaction,
  useUpdateTransaction,
  useCreateTransfer,
  useCreateRule,
  useBulkCategorize,
  useBulkMoveGroup,
  useBulkDeleteTransactions,
} from "../hooks/useApi";
import { Button, Modal, Input, Select, Label, EmptyState, Toast } from "./ui";
import { formatDate, formatMoney, groupDisplayName, toDateInputValue } from "../lib/format";
import { TransactionAttachments } from "./TransactionAttachments";

// The group dropdowns below need to disambiguate group names that repeat
// once per account (e.g. every account has a "General" group) - callers that
// span more than one account (Transactions.tsx) attach accountName; callers
// scoped to a single account (AccountDetail.tsx) don't need to.
type GroupOption = Group & { accountName?: string };

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
  groups?: GroupOption[];
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

  // Deleting hides the row immediately and gives a few seconds to undo
  // before the API call actually fires, instead of a confirm() dialog up
  // front - only one pending delete at a time; starting a new one finalizes
  // whatever was already pending.
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    };
  }, []);

  function scheduleDelete(t: Transaction) {
    if (pendingDelete && pendingDeleteTimer.current) {
      clearTimeout(pendingDeleteTimer.current);
      deleteTransaction.mutate(pendingDelete.id);
    }
    setPendingDelete(t);
    pendingDeleteTimer.current = setTimeout(() => {
      deleteTransaction.mutate(t.id);
      setPendingDelete(null);
    }, 5000);
  }

  function undoDelete() {
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    setPendingDelete(null);
  }

  const visibleTransactions = useMemo(
    () => transactions.filter((t) => t.id !== pendingDelete?.id),
    [transactions, pendingDelete]
  );

  // After a manual category pick (the quick inline Select, not the full Edit
  // modal), check whether other transactions share this description and
  // aren't already in that category - if so, offer to turn it into a rule
  // (and optionally fix up the existing ones too) instead of leaving the
  // user to notice and recategorize each one by hand later.
  const [ruleSuggestion, setRuleSuggestion] = useState<{
    transaction: Transaction;
    categoryId: string;
    category: Category;
    similar: SimilarTransaction[];
  } | null>(null);

  async function handleCategoryChange(t: Transaction, categoryId: string) {
    updateTransaction.mutate({ id: t.id, data: { categoryId: categoryId || null } });
    if (!categoryId) return;
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    try {
      const res = await getSimilarTransactions(t.id, categoryId);
      if (res.count > 0) {
        setRuleSuggestion({ transaction: t, categoryId, category, similar: res.transactions });
      }
    } catch {
      // best-effort suggestion - the category change itself already succeeded
    }
  }

  // Transfers can't be bulk-acted on (mirrors the single-row restrictions
  // below), so they're excluded from "select all" and can't be checked.
  const selectableIds = useMemo(() => visibleTransactions.filter((t) => !t.isTransfer).map((t) => t.id), [visibleTransactions]);
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
    return <EmptyState message="No transactions match these filters. Try widening the date range or clearing a filter." />;
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
      {/* Card layout for narrow (phone) viewports - the table below has too many
          columns (checkbox, date, description, category, group, balance,
          actions) to reflow sensibly at that width, even with horizontal
          scroll, so it's a separate layout rather than a CSS-only reshuffle. */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {visibleTransactions.map((t) => {
          const categoryColor = t.category?.color ?? "#898781";
          const categoryInitial = (t.category?.name ?? "?").slice(0, 1).toUpperCase();
          return (
            <div key={t.id} className="rounded-2xl border border-hairline bg-surface p-3.5">
              <div className="flex items-center gap-3">
                {!t.isTransfer && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleOne(t.id)}
                    aria-label={`Select transaction ${t.description}`}
                    className="shrink-0"
                  />
                )}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ background: `${categoryColor}26`, color: categoryColor }}
                >
                  {categoryInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{t.description}</p>
                    <span
                      className={`shrink-0 text-sm font-semibold ${t.amount >= 0 ? "text-good" : "text-ink-secondary"}`}
                    >
                      {formatMoney(t.amount, currency)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {formatDate(t.date)}
                    {showAccountColumn && t.account ? ` · ${t.account.name}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Select
                  value={t.categoryId ?? ""}
                  onChange={(e) => handleCategoryChange(t, e.target.value)}
                  className="w-auto rounded-full border-hairline-strong bg-black/5 py-1 pl-2.5 text-xs dark:bg-white/5"
                >
                  <option value="">Uncategorized</option>
                  {assignableCategories(categories).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                {groups && groups.length > 1 && (
                  <Select
                    value={t.groupId}
                    onChange={(e) => updateTransaction.mutate({ id: t.id, data: { groupId: e.target.value } })}
                    className="w-auto rounded-full border-hairline-strong bg-black/5 py-1 pl-2.5 text-xs dark:bg-white/5"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {groupDisplayName(g)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {(t.notes || (runningBalances && runningBalances[t.id] != null)) && (
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-muted">
                  <span className="truncate">{t.notes}</span>
                  {runningBalances && runningBalances[t.id] != null && (
                    <span className="shrink-0">Balance: {formatMoney(runningBalances[t.id], currency)}</span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-4 border-t border-hairline pt-2.5 text-xs font-medium">
                <button className="text-ink-muted hover:text-brand" onClick={() => setEditing(t)}>
                  Edit
                </button>
                {!t.isTransfer && (
                  <button className="text-ink-muted hover:text-critical" onClick={() => scheduleDelete(t)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-hairline sm:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-muted dark:bg-white/5 dark:text-ink-muted">
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
          <tbody className="divide-y divide-slate-100 dark:divide-hairline">
            {visibleTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-black/5 dark:hover:bg-white/5">
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
                <td className="whitespace-nowrap px-4 py-2 text-ink-secondary">{formatDate(t.date)}</td>
              <td className="max-w-xs px-4 py-2 text-ink">
                <div className="truncate" title={t.description}>
                  {t.description}
                </div>
              </td>
              {showAccountColumn && (
                <td className="whitespace-nowrap px-4 py-2 text-ink-secondary">{t.account?.name}</td>
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
                        {groupDisplayName(g)}
                      </option>
                    ))}
                  </Select>
                </td>
              )}
              <td className="px-4 py-2">
                <Select
                  value={t.categoryId ?? ""}
                  onChange={(e) => handleCategoryChange(t, e.target.value)}
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
              <td className="max-w-[12rem] px-4 py-2 text-ink-muted">
                <div className="truncate" title={t.notes ?? ""}>
                  {t.notes ?? "—"}
                </div>
              </td>
              <td
                className={`whitespace-nowrap px-4 py-2 text-right font-medium ${
                  t.amount >= 0 ? "text-good" : "text-ink-secondary"
                }`}
              >
                {formatMoney(t.amount, currency)}
              </td>
              {runningBalances && (
                <td className="whitespace-nowrap px-4 py-2 text-right text-ink-secondary">
                  {runningBalances[t.id] != null ? formatMoney(runningBalances[t.id], currency) : "—"}
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <Button variant="ghost" onClick={() => setEditing(t)}>
                  Edit
                </Button>
                {!t.isTransfer && (
                  <Button variant="ghost" onClick={() => scheduleDelete(t)}>
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {pendingDelete && (
        <Toast message={`Deleted "${pendingDelete.description}"`} actionLabel="Undo" onAction={undoDelete} />
      )}

      {ruleSuggestion && (
        <RuleSuggestionModal
          transaction={ruleSuggestion.transaction}
          categoryId={ruleSuggestion.categoryId}
          categoryName={ruleSuggestion.category.name}
          similar={ruleSuggestion.similar}
          onClose={() => setRuleSuggestion(null)}
        />
      )}

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
  groups?: GroupOption[];
  onClear: () => void;
  onCategorize: (categoryId: string) => void;
  onMoveGroup: (groupId: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-sm">
      <span className="font-medium text-ink-secondary">{count} selected</span>
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
              {groupDisplayName(g)}
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
            <p className="text-xs text-ink-muted">
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
            {sameAccountAndGroup && <p className="text-xs text-critical">Source and destination must be different.</p>}
          </>
        )}
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
        <TransactionAttachments transactionId={transaction.id} />
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
          <p className="text-xs text-critical">{getErrorMessage(createTransfer.error ?? deleteTransaction.error)}</p>
        )}
      </div>
    </Modal>
  );
}

function RuleSuggestionModal({
  transaction,
  categoryId,
  categoryName,
  similar,
  onClose,
}: {
  transaction: Transaction;
  categoryId: string;
  categoryName: string;
  similar: SimilarTransaction[];
  onClose: () => void;
}) {
  const createRule = useCreateRule();
  const bulkCategorize = useBulkCategorize();
  const [pattern, setPattern] = useState(transaction.description);
  const [alsoApply, setAlsoApply] = useState(true);

  const submit = () => {
    if (!pattern.trim()) return;
    createRule.mutate({ pattern: pattern.trim(), matchType: "CONTAINS", amountSign: "ANY", categoryId, priority: 0 });
    if (alsoApply && similar.length > 0) {
      bulkCategorize.mutate({ transactionIds: similar.map((s) => s.id), categoryId });
    }
    onClose();
  };

  return (
    <Modal title="Create a rule?" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-secondary">
          Found {similar.length} other transaction{similar.length === 1 ? "" : "s"} matching "{transaction.description}".
          Auto-categorize these as <strong className="text-ink">{categoryName}</strong> going forward?
        </p>
        <div>
          <Label>Rule pattern (matches descriptions containing this text)</Label>
          <Input value={pattern} onChange={(e) => setPattern(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input type="checkbox" checked={alsoApply} onChange={(e) => setAlsoApply(e.target.checked)} />
          Also apply {categoryName} to these {similar.length} transaction{similar.length === 1 ? "" : "s"} now
        </label>
        <div className="max-h-32 overflow-y-auto rounded-lg border border-hairline text-xs">
          {similar.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-hairline px-2 py-1.5 last:border-0">
              <span className="truncate text-ink-secondary">{s.description}</span>
              <span className="shrink-0 pl-2 text-ink-muted">{formatMoney(s.amount)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={submit} disabled={!pattern.trim()}>
            Create rule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
