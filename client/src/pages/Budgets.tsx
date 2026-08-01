import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBudgets, useBudgetMonthlyTrend, useCreateBudget, useUpdateBudget, useDeleteBudget, useCategories } from "../hooks/useApi";
import { Card, Button, Modal, Input, Select, Label, EmptyState, ProgressBar, Badge, Loading, ChartTooltip, StatCard } from "../components/ui";
import { assignableCategories } from "../lib/api";
import { formatMoney } from "../lib/format";
import type { Budget, BudgetPeriod } from "../lib/api";

const PERIOD_LABELS: Record<BudgetPeriod, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly" };

export function Budgets() {
  const { data: budgets, isLoading } = useBudgets();
  const { data: trend } = useBudgetMonthlyTrend(6);
  const deleteBudget = useDeleteBudget();
  const [showAdd, setShowAdd] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const hasBudgets = (budgets?.length ?? 0) > 0;

  // Each budget already carries amount/spent for its own current period (see
  // withSpend on the server), so the overall total is just a straight sum
  // across whatever's currently active - no separate endpoint needed.
  const overall = useMemo(() => {
    const planned = budgets?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
    const consumed = budgets?.reduce((sum, b) => sum + b.spent, 0) ?? 0;
    return { planned, consumed, remaining: planned - consumed };
  }, [budgets]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Budgets</h1>
          <p className="text-sm text-ink-muted">Optional spending limits per category, with progress for the current period.</p>
        </div>
        <Button className="self-start sm:self-auto" onClick={() => setShowAdd(true)}>
          + Add budget
        </Button>
      </div>

      {isLoading && <Loading />}
      {!isLoading && !hasBudgets && (
        <EmptyState
          title="Set your first budget"
          message="Set a monthly limit for a category like Groceries or Dining Out and track spending against it."
          action={{ label: "+ Add budget", onClick: () => setShowAdd(true) }}
        />
      )}

      {hasBudgets && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Planned this period" value={formatMoney(overall.planned)} />
          <StatCard label="Consumed this period" value={formatMoney(overall.consumed)} tone={overall.remaining < 0 ? "bad" : undefined} />
          <StatCard
            label={overall.remaining < 0 ? "Over budget" : "Remaining"}
            value={formatMoney(Math.abs(overall.remaining))}
            tone={overall.remaining < 0 ? "bad" : "good"}
          />
        </div>
      )}

      {hasBudgets && (
        <Card className="mb-4">
          <h2 className="mb-1 text-sm font-semibold text-ink-secondary">Overall: planned vs. consumed</h2>
          <p className="mb-3 text-xs text-ink-muted">
            Combined across every active budget's own current period (monthly, quarterly, or yearly, as set per category).
          </p>
          <ProgressBar
            value={overall.planned > 0 ? (overall.consumed / overall.planned) * 100 : 0}
            color={overall.remaining < 0 ? "var(--color-critical)" : undefined}
          />
        </Card>
      )}

      {hasBudgets && trend && trend.months.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-1 text-sm font-semibold text-ink-secondary">Month on month</h2>
          <p className="mb-3 text-xs text-ink-muted">
            Actual spend in budgeted categories vs. today's combined monthly budget target of {formatMoney(trend.totalPlanned)}.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend.months} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
              <XAxis dataKey="label" tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--color-hairline-strong)" }} tickLine={false} />
              <YAxis
                tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={80}
                tickFormatter={(v) => formatMoney(v)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-surface-hover)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-ink-secondary)" }} />
              <Bar dataKey="planned" name="Planned" fill="var(--color-ink-muted)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="spent" name="Spent" fill="var(--color-brand)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {budgets?.map((budget) => {
          const pct = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
          const remaining = budget.amount - budget.spent;
          const over = remaining < 0;
          return (
            <Card key={budget.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <Badge color={budget.category?.color}>{budget.category?.name}</Badge>
                  <p className="mt-1 text-xs text-ink-muted">{PERIOD_LABELS[budget.period]}</p>
                </div>
                <div className="flex gap-2 text-xs text-ink-muted">
                  <button className="hover:text-brand" onClick={() => setEditingBudget(budget)}>
                    Edit
                  </button>
                  <button
                    className="hover:text-critical"
                    onClick={() => {
                      if (confirm(`Remove budget for ${budget.category?.name}?`)) deleteBudget.mutate(budget.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <p className={`text-lg font-semibold ${over ? "text-critical" : "text-ink"}`}>{formatMoney(budget.spent)}</p>
                  <p className="text-xs text-ink-muted">of {formatMoney(budget.amount)}</p>
                </div>
                <ProgressBar value={pct} color={over ? "var(--color-critical)" : pct >= 80 ? "#e0a020" : undefined} />
              </div>
              <p className={`text-xs ${over ? "text-critical" : "text-ink-muted"}`}>
                {over ? `${formatMoney(Math.abs(remaining))} over budget` : `${formatMoney(remaining)} remaining`}
              </p>
            </Card>
          );
        })}
      </div>

      {showAdd && <BudgetModal title="Add budget" onClose={() => setShowAdd(false)} />}
      {editingBudget && <BudgetModal title="Edit budget" budget={editingBudget} onClose={() => setEditingBudget(null)} />}
    </div>
  );
}

function BudgetModal({ title, budget, onClose }: { title: string; budget?: Budget; onClose: () => void }) {
  const { data: categories } = useCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? "");
  const [amount, setAmount] = useState(budget ? String(budget.amount) : "");
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? "MONTHLY");

  const expenseCategories = assignableCategories(categories).filter((c) => c.type === "EXPENSE");

  const submit = () => {
    if (!categoryId || !amount) return;
    if (budget) updateBudget.mutate({ id: budget.id, data: { amount: Number(amount), period } });
    else createBudget.mutate({ categoryId, amount: Number(amount), period });
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!!budget}>
            <option value="">Select category…</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Period</Label>
            <Select value={period} onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          </div>
        </div>
        <Button className="mt-2" onClick={submit}>
          {budget ? "Save changes" : "Add budget"}
        </Button>
      </div>
    </Modal>
  );
}
