import { useEffect, useState } from "react";
import {
  useAccounts,
  useBuckets,
  useCategories,
  useCreateTransaction,
  useCreateTransfer,
  useMerchantSuggestion,
} from "../hooks/useApi";
import { Button, Input, Label, Modal, Select } from "./ui";
import { assignableCategories, getErrorMessage } from "../lib/api";

export function AddTransactionModal({
  onClose,
  defaultAccountId,
  defaultBucketId,
}: {
  onClose: () => void;
  // When set (e.g. opened from an account's own page), the account is
  // preselected and locked rather than left as a free-choice dropdown.
  defaultAccountId?: string;
  // Same idea, but for a bucket - set when opened from a bucket's own page.
  defaultBucketId?: string;
}) {
  const { data: accounts } = useAccounts();
  const { data: buckets } = useBuckets();
  const { data: categories } = useCategories();
  const createTransaction = useCreateTransaction();
  const createTransfer = useCreateTransfer();

  const defaultAccount = accounts?.find((a) => a.id === defaultAccountId);
  const defaultBucket = buckets?.find((b) => b.id === defaultBucketId);
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [groupId, setGroupId] = useState(
    defaultAccount?.groups.find((g) => g.isDefault)?.id ?? defaultAccount?.groups[0]?.id ?? ""
  );
  const [bucketId, setBucketId] = useState(defaultBucketId ?? "");
  const [isNonBudget, setIsNonBudget] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [transferToAccountId, setTransferToAccountId] = useState("");
  const [transferToGroupId, setTransferToGroupId] = useState("");

  // Debounced so typing doesn't fire a lookup on every keystroke - only
  // matters once the description settles for a moment.
  const [debouncedDescription, setDebouncedDescription] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDescription(description), 400);
    return () => clearTimeout(t);
  }, [description]);
  const { data: suggestion } = useMerchantSuggestion(debouncedDescription);
  const suggestedCategory = categories?.find((c) => c.id === suggestion?.categoryId);
  const showSuggestion = !categoryId && suggestion?.categoryId && suggestedCategory && (suggestion.matchCount ?? 0) >= 2;

  const account = accounts?.find((a) => a.id === accountId);
  const isTransferCategory = categories?.find((c) => c.id === categoryId)?.type === "TRANSFER";
  const transferToAccount = accounts?.find((a) => a.id === transferToAccountId);
  const sameAccountAndGroup =
    isTransferCategory && accountId === transferToAccountId && groupId === transferToGroupId;

  return (
    <Modal title="Add transaction" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Account</Label>
          {defaultAccountId ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-ink-secondary dark:border-hairline-strong dark:bg-white/5 dark:text-ink-secondary">
              {defaultAccount?.name}
            </p>
          ) : (
            <Select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                const acc = accounts?.find((a) => a.id === e.target.value);
                setGroupId(acc?.groups.find((g) => g.isDefault)?.id ?? acc?.groups[0]?.id ?? "");
              }}
            >
              <option value="">Select account…</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        {account && account.groups.length > 1 && (
          <div>
            <Label>Group</Label>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
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
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Coffee shop" />
          {showSuggestion && (
            <button
              type="button"
              className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs text-brand hover:bg-brand/15"
              onClick={() => setCategoryId(suggestedCategory!.id)}
            >
              Similar transactions are usually categorized as <strong>{suggestedCategory!.name}</strong> - use this?
            </button>
          )}
        </div>
        {!isTransferCategory && (
          <div>
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === "EXPENSE" ? "primary" : "secondary"}
                className="flex-1"
                onClick={() => setType("EXPENSE")}
              >
                Expense
              </Button>
              <Button
                type="button"
                variant={type === "INCOME" ? "primary" : "secondary"}
                className="flex-1"
                onClick={() => setType("INCOME")}
              >
                Income
              </Button>
            </div>
          </div>
        )}
        <div>
          <Label>{isTransferCategory ? "Amount to transfer" : "Amount"}</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250" />
        </div>
        <div>
          <Label>Category (optional, auto-detected if left blank)</Label>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setTransferToAccountId("");
              setTransferToGroupId("");
              const category = categories?.find((c) => c.id === e.target.value);
              if (category?.type === "INCOME" || category?.type === "EXPENSE") setType(category.type);
            }}
          >
            <option value="">Auto-detect</option>
            {assignableCategories(categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {isTransferCategory && (
          <>
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
        {!isTransferCategory && (
          <>
            <div>
              <Label>Bucket (optional)</Label>
              {defaultBucketId ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-ink-secondary dark:border-hairline-strong dark:bg-white/5 dark:text-ink-secondary">
                  {defaultBucket?.name}
                </p>
              ) : (
                <Select value={bucketId} onChange={(e) => setBucketId(e.target.value)}>
                  <option value="">None</option>
                  {buckets?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={isNonBudget}
                onChange={(e) => setIsNonBudget(e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              One-off / non-budget expense (e.g. a big purchase, travel)
            </label>
          </>
        )}
        <Button
          className="mt-2"
          disabled={
            !accountId ||
            !groupId ||
            !description.trim() ||
            !amount ||
            (isTransferCategory && (!transferToAccountId || !transferToGroupId || sameAccountAndGroup))
          }
          onClick={() => {
            if (isTransferCategory) {
              createTransfer.mutate(
                {
                  type: "ACCOUNT_TRANSFER",
                  date: new Date(date).toISOString(),
                  amount: Math.abs(Number(amount)),
                  note: description.trim(),
                  fromAccountId: accountId,
                  fromGroupId: groupId,
                  toAccountId: transferToAccountId,
                  toGroupId: transferToGroupId,
                },
                { onSuccess: onClose }
              );
            } else {
              createTransaction.mutate(
                {
                  accountId,
                  groupId,
                  date: new Date(date).toISOString(),
                  description: description.trim(),
                  amount: type === "INCOME" ? Math.abs(Number(amount)) : -Math.abs(Number(amount)),
                  categoryId: categoryId || undefined,
                  bucketId: bucketId || undefined,
                  isNonBudget,
                },
                { onSuccess: onClose }
              );
            }
          }}
        >
          {isTransferCategory ? "Add transfer" : "Add transaction"}
        </Button>
        {(createTransaction.isError || createTransfer.isError) && (
          <p className="text-xs text-critical">{getErrorMessage(createTransaction.error ?? createTransfer.error)}</p>
        )}
      </div>
    </Modal>
  );
}
