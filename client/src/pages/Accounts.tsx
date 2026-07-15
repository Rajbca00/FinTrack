import { useState } from "react";
import { Link } from "react-router-dom";
import { useAccounts, useCreateAccount, useBalances, useArchiveAccount } from "../hooks/useApi";
import { Card, Button, Modal, Input, Select, Label, Badge, EmptyState } from "../components/ui";
import { formatMoney } from "../lib/format";
import type { AccountType } from "../lib/api";

export function Accounts() {
  const { data: accounts, isLoading } = useAccounts();
  const { data: balances } = useBalances();
  const createAccount = useCreateAccount();
  const archiveAccount = useArchiveAccount();
  const [showCreate, setShowCreate] = useState(false);

  const balanceByAccount = new Map((balances ?? []).map((b) => [b.id, b]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Accounts</h1>
          <p className="text-sm text-ink-muted">Bank accounts and credit cards, including multi-purpose funds.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Add account</Button>
      </div>

      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {!isLoading && accounts?.length === 0 && <EmptyState message="No accounts yet. Add your first bank account or credit card." />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts?.map((account) => {
          const balance = balanceByAccount.get(account.id);
          return (
            <Card key={account.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/accounts/${account.id}`} className="font-semibold text-ink hover:underline dark:text-ink">
                    {account.name}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {account.type === "BANK" ? "Bank account" : "Credit card"}
                    {account.institution ? ` · ${account.institution}` : ""}
                    {account.last4 ? ` · ••${account.last4}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Archive ${account.name}?`)) archiveAccount.mutate(account.id);
                  }}
                >
                  Archive
                </Button>
              </div>

              <p className="text-2xl font-semibold text-ink">
                {formatMoney(balance?.balance ?? 0, account.currency)}
              </p>

              {account.groups.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {account.groups.map((g) => {
                    const gb = balance?.groups.find((x) => x.id === g.id);
                    return (
                      <Badge key={g.id} color={g.color}>
                        {g.name}: {formatMoney(gb?.balance ?? 0, account.currency)}
                      </Badge>
                    );
                  })}
                </div>
              )}

              <Link to={`/accounts/${account.id}`} className="text-sm font-medium text-brand hover:underline">
                View transactions →
              </Link>
            </Card>
          );
        })}
      </div>

      {showCreate && <CreateAccountModal onClose={() => setShowCreate(false)} onCreate={(data) => createAccount.mutate(data)} />}
    </div>
  );
}

function CreateAccountModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; type: AccountType; institution?: string; last4?: string; creditLimit?: number; openingBalance: number }) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("BANK");
  const [institution, setInstitution] = useState("");
  const [last4, setLast4] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      type,
      institution: institution.trim() || undefined,
      last4: last4.trim() || undefined,
      creditLimit: type === "CREDIT_CARD" && creditLimit ? Number(creditLimit) : undefined,
      openingBalance: Number(openingBalance) || 0,
    });
    onClose();
  };

  return (
    <Modal title="Add account" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ICICI Savings" autoFocus />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            <option value="BANK">Bank account</option>
            <option value="CREDIT_CARD">Credit card</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Institution</Label>
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="ICICI Bank" />
          </div>
          <div>
            <Label>Last 4 digits</Label>
            <Input value={last4} onChange={(e) => setLast4(e.target.value)} maxLength={4} placeholder="1234" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Opening balance</Label>
            <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </div>
          {type === "CREDIT_CARD" && (
            <div>
              <Label>Credit limit</Label>
              <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
            </div>
          )}
        </div>
        <Button className="mt-2" onClick={submit}>
          Create account
        </Button>
      </div>
    </Modal>
  );
}
