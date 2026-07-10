import { useState } from "react";
import { useAccounts, useTransfers, useCreateTransfer, useDeleteTransfer } from "../hooks/useApi";
import { Card, Button, Select, Input, Label } from "../components/ui";
import { formatDate, formatMoney } from "../lib/format";
import type { TransferType } from "../lib/api";

export function Transfers() {
  const { data: accounts } = useAccounts();
  const { data: transfers } = useTransfers();
  const createTransfer = useCreateTransfer();
  const deleteTransfer = useDeleteTransfer();

  const [kind, setKind] = useState<TransferType>("ACCOUNT_TRANSFER");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [fromAccountId, setFromAccountId] = useState("");
  const [fromGroupId, setFromGroupId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [toGroupId, setToGroupId] = useState("");

  const [reallocAccountId, setReallocAccountId] = useState("");
  const [reallocFromGroupId, setReallocFromGroupId] = useState("");
  const [reallocToGroupId, setReallocToGroupId] = useState("");

  const fromAccount = accounts?.find((a) => a.id === fromAccountId);
  const toAccount = accounts?.find((a) => a.id === toAccountId);
  const reallocAccount = accounts?.find((a) => a.id === reallocAccountId);

  const canSubmit =
    amount &&
    (kind === "ACCOUNT_TRANSFER"
      ? fromAccountId && fromGroupId && toAccountId && toGroupId && !(fromAccountId === toAccountId && fromGroupId === toGroupId)
      : reallocAccountId && reallocFromGroupId && reallocToGroupId && reallocFromGroupId !== reallocToGroupId);

  const submit = () => {
    if (kind === "ACCOUNT_TRANSFER") {
      createTransfer.mutate({
        type: "ACCOUNT_TRANSFER",
        date: new Date(date).toISOString(),
        amount: Number(amount),
        note: note || undefined,
        fromAccountId,
        fromGroupId,
        toAccountId,
        toGroupId,
      });
    } else {
      createTransfer.mutate({
        type: "GROUP_REALLOCATION",
        date: new Date(date).toISOString(),
        amount: Number(amount),
        note: note || undefined,
        accountId: reallocAccountId,
        fromGroupId: reallocFromGroupId,
        toGroupId: reallocToGroupId,
      });
    }
    setAmount("");
    setNote("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Transfers</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Move real money between accounts, or reallocate funds between purpose groups inside one account (e.g. Personal → Temple Fund).
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button variant={kind === "ACCOUNT_TRANSFER" ? "primary" : "secondary"} onClick={() => setKind("ACCOUNT_TRANSFER")}>
            Account to account
          </Button>
          <Button variant={kind === "GROUP_REALLOCATION" ? "primary" : "secondary"} onClick={() => setKind("GROUP_REALLOCATION")}>
            Reallocate within an account
          </Button>
        </div>

        {kind === "ACCOUNT_TRANSFER" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>From account</Label>
              <Select
                value={fromAccountId}
                onChange={(e) => {
                  setFromAccountId(e.target.value);
                  setFromGroupId(accounts?.find((a) => a.id === e.target.value)?.groups.find((g) => g.isDefault)?.id ?? "");
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
            <div>
              <Label>From group</Label>
              <Select value={fromGroupId} onChange={(e) => setFromGroupId(e.target.value)} disabled={!fromAccount}>
                <option value="">Select group…</option>
                {fromAccount?.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>To account</Label>
              <Select
                value={toAccountId}
                onChange={(e) => {
                  setToAccountId(e.target.value);
                  setToGroupId(accounts?.find((a) => a.id === e.target.value)?.groups.find((g) => g.isDefault)?.id ?? "");
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
            <div>
              <Label>To group</Label>
              <Select value={toGroupId} onChange={(e) => setToGroupId(e.target.value)} disabled={!toAccount}>
                <option value="">Select group…</option>
                {toAccount?.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label>Account</Label>
              <Select
                value={reallocAccountId}
                onChange={(e) => {
                  setReallocAccountId(e.target.value);
                  setReallocFromGroupId("");
                  setReallocToGroupId("");
                }}
              >
                <option value="">Select account…</option>
                {accounts
                  ?.filter((a) => a.groups.length > 1)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label>From group</Label>
              <Select value={reallocFromGroupId} onChange={(e) => setReallocFromGroupId(e.target.value)} disabled={!reallocAccount}>
                <option value="">Select group…</option>
                {reallocAccount?.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>To group</Label>
              <Select value={reallocToGroupId} onChange={(e) => setReallocToGroupId(e.target.value)} disabled={!reallocAccount}>
                <option value="">Select group…</option>
                {reallocAccount?.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
            {accounts && accounts.filter((a) => a.groups.length > 1).length === 0 && (
              <p className="col-span-3 text-xs text-slate-500">
                No account has more than one group yet. Add a group from an account's page first.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly temple contribution" />
          </div>
        </div>

        <Button className="self-start" disabled={!canSubmit || createTransfer.isPending} onClick={submit}>
          {createTransfer.isPending ? "Saving…" : "Record transfer"}
        </Button>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">History</h2>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">From</th>
                <th className="px-4 py-2 font-medium">To</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transfers?.map((t) => {
                const from = t.transactions.find((x) => x.amount < 0);
                const to = t.transactions.find((x) => x.amount > 0);
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-2">{formatDate(t.date)}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {t.type === "ACCOUNT_TRANSFER" ? "Account transfer" : "Reallocation"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {from?.account?.name} · {from?.group?.name}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {to?.account?.name} · {to?.group?.name}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{t.note ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatMoney(t.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="text-xs text-slate-400 hover:text-red-500"
                        onClick={() => {
                          if (confirm("Delete this transfer? Both linked transactions will be removed.")) deleteTransfer.mutate(t.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(transfers?.length ?? 0) === 0 && <p className="p-6 text-center text-sm text-slate-500">No transfers recorded yet.</p>}
        </Card>
      </div>
    </div>
  );
}
