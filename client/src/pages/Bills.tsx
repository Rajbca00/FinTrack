import { useState } from "react";
import {
  useBills,
  useBillSuggestions,
  useCreateBill,
  useUpdateBill,
  useDeleteBill,
  useCategories,
} from "../hooks/useApi";
import { Card, Button, Modal, Input, Select, Label, EmptyState, Badge, Loading } from "../components/ui";
import { assignableCategories } from "../lib/api";
import { formatMoney, formatDate, toDateInputValue } from "../lib/format";
import type { Bill, BillRecurrence, BillSuggestion } from "../lib/api";

const RECURRENCE_LABELS: Record<BillRecurrence, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export function Bills() {
  const { data, isLoading } = useBills();
  const { data: suggestions } = useBillSuggestions();
  const deleteBill = useDeleteBill();
  const [showAdd, setShowAdd] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [prefill, setPrefill] = useState<BillSuggestion | null>(null);

  const bills = data?.bills ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Bills</h1>
          <p className="text-sm text-ink-muted">Recurring expenses like EMIs, insurance, rent, and subscriptions.</p>
        </div>
        <Button className="self-start sm:self-auto" onClick={() => setShowAdd(true)}>
          + Add bill
        </Button>
      </div>

      {(suggestions?.length ?? 0) > 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-brand/30 bg-brand/5">
          <p className="text-sm font-semibold text-ink">Looks like these might be recurring</p>
          <p className="text-xs text-ink-muted">
            Detected from transactions with the same description appearing in 2+ different months at a similar amount.
          </p>
          <div className="flex flex-col gap-2">
            {suggestions?.map((s) => (
              <div key={s.description} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-ink">{s.description}</p>
                  <p className="text-xs text-ink-muted">
                    {formatMoney(s.amount)} · seen {s.occurrences} months
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setPrefill(s)}>
                  Track as bill
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading && <Loading />}
      {!isLoading && bills.length === 0 && (
        <EmptyState
          title="Add your first bill"
          message="Track a recurring expense like rent, an EMI, or a subscription to see upcoming due dates."
          action={{ label: "+ Add bill", onClick: () => setShowAdd(true) }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bills.map((bill) => (
          <Card key={bill.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-ink">{bill.name}</p>
                <p className="text-xs text-ink-muted">
                  {RECURRENCE_LABELS[bill.recurrence]}
                  {bill.category && (
                    <>
                      {" · "}
                      <Badge color={bill.category.color}>{bill.category.name}</Badge>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2 text-xs text-ink-muted">
                <button className="hover:text-brand" onClick={() => setEditingBill(bill)}>
                  Edit
                </button>
                <button
                  className="hover:text-critical"
                  onClick={() => {
                    if (confirm(`Remove ${bill.name}?`)) deleteBill.mutate(bill.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-xl font-semibold text-ink">{formatMoney(bill.amount)}</p>
            <p className="text-xs text-ink-muted">Next due {formatDate(bill.nextDueDate)}</p>
          </Card>
        ))}
      </div>

      {showAdd && <BillModal title="Add bill" onClose={() => setShowAdd(false)} />}
      {prefill && <BillModal title="Track as bill" suggestion={prefill} onClose={() => setPrefill(null)} />}
      {editingBill && <BillModal title="Edit bill" bill={editingBill} onClose={() => setEditingBill(null)} />}
    </div>
  );
}

function BillModal({
  title,
  bill,
  suggestion,
  onClose,
}: {
  title: string;
  bill?: Bill;
  suggestion?: BillSuggestion;
  onClose: () => void;
}) {
  const { data: categories } = useCategories();
  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const [name, setName] = useState(bill?.name ?? suggestion?.description ?? "");
  const [amount, setAmount] = useState(bill ? String(bill.amount) : suggestion ? String(suggestion.amount) : "");
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? suggestion?.categoryId ?? "");
  const [nextDueDate, setNextDueDate] = useState(
    bill ? toDateInputValue(bill.nextDueDate) : suggestion ? toDateInputValue(suggestion.suggestedNextDueDate) : ""
  );
  const [recurrence, setRecurrence] = useState<BillRecurrence>(bill?.recurrence ?? "MONTHLY");

  const submit = () => {
    if (!name.trim() || !amount || !nextDueDate) return;
    const data = {
      name: name.trim(),
      amount: Number(amount),
      categoryId: categoryId || null,
      nextDueDate,
      recurrence,
    };
    if (bill) updateBill.mutate({ id: bill.id, data });
    else createBill.mutate(data);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home Loan EMI" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Recurrence</Label>
            <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as BillRecurrence)}>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Next due date</Label>
            <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Category (optional)</Label>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {assignableCategories(categories).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button className="mt-2" onClick={submit}>
          {bill ? "Save changes" : "Add bill"}
        </Button>
      </div>
    </Modal>
  );
}
