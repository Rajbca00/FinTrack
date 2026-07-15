import { useState } from "react";
import { useAccounts, useCategories, useCreateTransaction, useCreateTransfer } from "../hooks/useApi";
import { Button, Input, Label, Modal, Select } from "./ui";
import { assignableCategories, getErrorMessage } from "../lib/api";

export function AddTransactionModal({
  onClose,
  defaultAccountId,
}: {
  onClose: () => void;
  // When set (e.g. opened from an account's own page), the account is
  // preselected and locked rather than left as a free-choice dropdown.
  defaultAccountId?: string;
}) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const createTransaction = useCreateTransaction();
  const createTransfer = useCreateTransfer();

  const defaultAccount = accounts?.find((a) => a.id === defaultAccountId);
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [groupId, setGroupId] = useState(
    defaultAccount?.groups.find((g) => g.isDefault)?.id ?? defaultAccount?.groups[0]?.id ?? ""
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transferToAccountId, setTransferToAccountId] = useState("");
  const [transferToGroupId, setTransferToGroupId] = useState("");

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
        </div>
        <div>
          <Label>{isTransferCategory ? "Amount to transfer" : "Amount (negative = money out, positive = money in)"}</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="-250" />
        </div>
        <div>
          <Label>Category (optional, auto-detected if left blank)</Label>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setTransferToAccountId("");
              setTransferToGroupId("");
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
                  amount: Number(amount),
                  categoryId: categoryId || undefined,
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
