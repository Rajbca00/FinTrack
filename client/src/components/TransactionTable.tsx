import { useState } from "react";
import type { Category, Group, Transaction } from "../lib/api";
import { useDeleteTransaction, useUpdateTransaction } from "../hooks/useApi";
import { Button, Modal, Input, Select, Label } from "./ui";
import { formatDate, formatMoney, toDateInputValue } from "../lib/format";

export function TransactionTable({
  transactions,
  categories,
  groups,
  showAccountColumn,
}: {
  transactions: Transaction[];
  categories: Category[];
  groups?: Group[];
  showAccountColumn?: boolean;
}) {
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const [editing, setEditing] = useState<Transaction | null>(null);

  if (transactions.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No transactions found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Description</th>
            {showAccountColumn && <th className="px-4 py-2 font-medium">Account</th>}
            {groups && groups.length > 1 && <th className="px-4 py-2 font-medium">Group</th>}
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Notes</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
            <th className="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {transactions.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
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
                  {categories.map((c) => (
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
                {formatMoney(t.amount)}
              </td>
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
  const [date, setDate] = useState(toDateInputValue(transaction.date));
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? "");
  const [notes, setNotes] = useState(transaction.notes ?? "");

  return (
    <Modal title="Edit transaction" onClose={onClose}>
      <div className="flex flex-col gap-3">
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
        <Button
          className="mt-2"
          onClick={() =>
            onSave({
              date: new Date(date).toISOString(),
              description,
              amount: transaction.isTransfer ? undefined : Number(amount),
              categoryId: categoryId || null,
              notes: notes || null,
            })
          }
        >
          Save changes
        </Button>
      </div>
    </Modal>
  );
}
