import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBucket, useUpdateBucket, useCategories, useTransactions, useTrend, useBreakdown } from "../hooks/useApi";
import { Card, Button, EmptyState, Loading, Select, StatCard, ChartTooltip } from "../components/ui";
import { BucketModal } from "./Buckets";
import { TransactionTable } from "../components/TransactionTable";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { formatMoney } from "../lib/format";
import { categoricalColor } from "../lib/palette";

export function BucketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: bucket } = useBucket(id);
  const { data: categories } = useCategories();
  const [showEdit, setShowEdit] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const updateBucket = useUpdateBucket();

  const { data: trend } = useTrend({ period: "month", bucketId: id });
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | undefined>(undefined);
  const activeMonth = useMemo(() => {
    if (!trend || trend.length === 0) return undefined;
    return trend.find((t) => t.key === selectedMonthKey) ?? trend[trend.length - 1];
  }, [trend, selectedMonthKey]);

  const monthRange = useMemo(() => {
    if (!activeMonth) return undefined;
    const [year, month] = activeMonth.key.split("-").map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
    return { from, to };
  }, [activeMonth]);

  const { data: breakdown } = useBreakdown({ bucketId: id, type: "EXPENSE", ...monthRange });

  const { data: txnData, isLoading } = useTransactions({
    bucketId: id,
    ...monthRange,
    pageSize: 100,
  });

  if (!bucket) return <Loading label="Loading bucket…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/buckets" className="text-xs text-ink-muted hover:underline">
            ← All buckets
          </Link>
          <h1 className="text-xl font-semibold text-ink">{bucket.name}</h1>
          <p className="text-sm text-ink-muted">Tagged from any account or card - not tied to one accounts's ledger.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowEdit(true)}>
            Edit bucket
          </Button>
          <Button onClick={() => setShowAddTransaction(true)}>+ Add transaction</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Balance" value={formatMoney(bucket.balance)} />
        <StatCard label="Received (all time)" value={formatMoney(bucket.totalReceived)} tone="good" />
        <StatCard label="Spent (all time)" value={formatMoney(bucket.totalSpent)} tone="bad" />
      </div>

      {trend && trend.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-secondary">Monthly view</h2>
            <Select value={activeMonth?.key ?? ""} onChange={(e) => setSelectedMonthKey(e.target.value)} className="w-auto">
              {trend.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Received this month" value={formatMoney(activeMonth?.income ?? 0)} tone="good" />
            <StatCard label="Spent this month" value={formatMoney(activeMonth?.expense ?? 0)} tone="bad" />
          </div>
        </div>
      )}

      {breakdown && breakdown.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink-secondary">
            Spending by category{activeMonth ? ` — ${activeMonth.label}` : ""}
          </h2>
          <ResponsiveContainer width="100%" height={Math.max(120, breakdown.length * 36)}>
            <BarChart data={breakdown} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid horizontal={false} stroke="var(--color-hairline)" />
              <XAxis type="number" tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--color-hairline-strong)" }} tickLine={false} tickFormatter={(v) => formatMoney(v)} />
              <YAxis type="category" dataKey="name" tick={{ fill: "var(--color-ink-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} width={140} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-surface-hover)" }} />
              <Bar dataKey="total" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {breakdown.map((entry, i) => (
                  <Cell key={entry.categoryId} fill={entry.color ?? categoricalColor(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Transactions{activeMonth ? ` — ${activeMonth.label}` : ""}</h2>
        {isLoading && <Loading />}
        {!isLoading && txnData && txnData.transactions.length === 0 && (
          <EmptyState
            title="No transactions yet"
            message="Tag a transaction into this bucket from Add/Edit transaction, or use the button above."
            action={{ label: "+ Add transaction", onClick: () => setShowAddTransaction(true) }}
          />
        )}
        {!isLoading && txnData && txnData.transactions.length > 0 && (
          <TransactionTable transactions={txnData.transactions} categories={categories ?? []} showAccountColumn />
        )}
      </div>

      {showEdit && (
        <BucketModal
          title="Edit bucket"
          initialName={bucket.name}
          initialColor={bucket.color ?? undefined}
          initialOpeningBalance={bucket.openingBalance}
          onClose={() => setShowEdit(false)}
          onSubmit={(data) => updateBucket.mutate({ id: bucket.id, data })}
        />
      )}
      {showAddTransaction && <AddTransactionModal defaultBucketId={bucket.id} onClose={() => setShowAddTransaction(false)} />}
    </div>
  );
}
