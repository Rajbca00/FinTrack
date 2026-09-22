import { useState } from "react";
import { Link } from "react-router-dom";
import { useBuckets, useCreateBucket, useDeleteBucket } from "../hooks/useApi";
import { Card, Button, Modal, Input, Label, EmptyState, Loading } from "../components/ui";
import { formatMoney } from "../lib/format";

export function Buckets() {
  const { data: buckets, isLoading } = useBuckets();
  const createBucket = useCreateBucket();
  const deleteBucket = useDeleteBucket();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Buckets</h1>
          <p className="text-sm text-ink-muted">
            Cross-account purposes like "Temple" or a family fund - tag any transaction from any account or card into
            one, and see what you've spent and received for that purpose, regardless of which card paid.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Add bucket</Button>
      </div>

      {isLoading && <Loading />}
      {!isLoading && buckets?.length === 0 && (
        <EmptyState
          title="Add your first bucket"
          message='Create a bucket like "Temple" or a pet/family fund, then tag transactions into it from any account - the bucket itself tracks a running balance like a lightweight account.'
          action={{ label: "+ Add bucket", onClick: () => setShowCreate(true) }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {buckets?.map((bucket) => (
          <Card key={bucket.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <Link to={`/buckets/${bucket.id}`} className="font-semibold text-ink hover:underline">
                  {bucket.name}
                </Link>
                <p className="text-xs text-ink-muted">{bucket.transactionCount} transaction(s)</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm(`Archive "${bucket.name}"?`)) deleteBucket.mutate(bucket.id);
                }}
              >
                Archive
              </Button>
            </div>

            <p className="text-2xl font-semibold text-ink">{formatMoney(bucket.balance)}</p>

            <div className="flex gap-4 text-xs text-ink-muted">
              <span>
                Received <span className="font-medium text-good">{formatMoney(bucket.totalReceived)}</span>
              </span>
              <span>
                Spent <span className="font-medium text-critical">{formatMoney(bucket.totalSpent)}</span>
              </span>
            </div>

            <Link to={`/buckets/${bucket.id}`} className="text-sm font-medium text-brand hover:underline">
              View this month →
            </Link>
          </Card>
        ))}
      </div>

      {showCreate && (
        <BucketModal
          title="Add bucket"
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createBucket.mutate(data)}
        />
      )}
    </div>
  );
}

export function BucketModal({
  title,
  initialName,
  initialColor,
  initialOpeningBalance,
  onClose,
  onSubmit,
}: {
  title: string;
  initialName?: string;
  initialColor?: string;
  initialOpeningBalance?: number;
  onClose: () => void;
  onSubmit: (data: { name: string; color?: string; openingBalance?: number }) => void;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [color, setColor] = useState(initialColor ?? "#eab308");
  const [openingBalance, setOpeningBalance] = useState(String(initialOpeningBalance ?? 0));

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), color, openingBalance: Number(openingBalance) || 0 });
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Temple" autoFocus />
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
            <Label>Starting balance (optional)</Label>
            <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </div>
        </div>
        <Button className="mt-2" onClick={submit}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
