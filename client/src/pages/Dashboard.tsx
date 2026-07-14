import { useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAccounts, useBalances, useBreakdown, useTrend } from "../hooks/useApi";
import { Card, Select, Label } from "../components/ui";
import { formatMoney } from "../lib/format";
import { CHROME, DIVERGING, categoricalColor, useIsDarkMode } from "../lib/palette";

type Period = "week" | "month" | "year";

export function Dashboard() {
  const dark = useIsDarkMode();
  const chrome = dark ? CHROME.dark : CHROME.light;
  const diverging = dark ? DIVERGING.dark : DIVERGING.light;

  const { data: accounts } = useAccounts();
  const { data: balances } = useBalances();
  const [period, setPeriod] = useState<Period>("month");
  const [accountId, setAccountId] = useState("");
  const [groupId, setGroupId] = useState("");
  // Only meaningful when period === "month" - lets the charts narrow down to
  // one specific month instead of showing the whole transaction history.
  const [selectedMonth, setSelectedMonth] = useState("");

  const selectedAccount = accounts?.find((a) => a.id === accountId);

  // Last 24 months, newest first, as "yyyy-MM" values - matches the format
  // produced by the monthly trend bucket keys in server/src/services/summary.ts.
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => {
      const d = subMonths(now, i);
      return { value: format(d, "yyyy-MM"), label: format(d, "MMM yyyy") };
    });
  }, []);

  const monthRange = useMemo(() => {
    if (period !== "month" || !selectedMonth) return {};
    const [year, month] = selectedMonth.split("-").map(Number);
    // Transaction dates are stored UTC-midnight-anchored (see date-only
    // handling in Transactions.tsx), so bounds are computed in UTC too -
    // using local-time month math here would shift the boundary by the
    // browser's UTC offset and clip transactions near month edges.
    const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
    return { from, to };
  }, [period, selectedMonth]);

  const { data: trend } = useTrend({
    period,
    accountId: accountId || undefined,
    groupId: groupId || undefined,
    ...monthRange,
  });
  const { data: breakdown } = useBreakdown({
    type: "EXPENSE",
    accountId: accountId || undefined,
    groupId: groupId || undefined,
    ...monthRange,
  });

  const totalBalance = useMemo(() => (balances ?? []).reduce((sum, a) => sum + a.balance, 0), [balances]);
  const currentPeriod = trend?.[trend.length - 1];
  const income = currentPeriod?.income ?? 0;
  const expense = currentPeriod?.expense ?? 0;

  const breakdownWithOther = useMemo(() => {
    if (!breakdown) return [];
    const top = breakdown.slice(0, 8);
    const rest = breakdown.slice(8);
    const otherTotal = rest.reduce((s, b) => s + b.total, 0);
    const items = top.map((b, i) => ({ ...b, color: categoricalColor(i, dark) }));
    if (otherTotal > 0) items.push({ categoryId: "other", name: "Other", color: chrome.mutedInk, total: otherTotal });
    return items;
  }, [breakdown, dark, chrome.mutedInk]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">An overview of your money across accounts and funds.</p>
      </div>

      <Card className="flex flex-wrap items-end gap-4">
        <div className="w-40">
          <Label>Period</Label>
          <Select
            value={period}
            onChange={(e) => {
              const next = e.target.value as Period;
              setPeriod(next);
              if (next !== "month") setSelectedMonth("");
            }}
          >
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Annually</option>
          </Select>
        </div>
        {period === "month" && (
          <div className="w-44">
            <Label>Month</Label>
            <Select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="">All months</option>
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="w-56">
          <Label>Account</Label>
          <Select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setGroupId("");
            }}
          >
            <option value="">All accounts</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        {selectedAccount && selectedAccount.groups.length > 1 && (
          <div className="w-56">
            <Label>Group</Label>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">All groups</option>
              {selectedAccount.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total balance" value={formatMoney(totalBalance)} />
        <StatCard label={`Income (${currentPeriod?.label ?? "this period"})`} value={formatMoney(income)} tone="good" />
        <StatCard label={`Expense (${currentPeriod?.label ?? "this period"})`} value={formatMoney(expense)} tone="bad" />
        <StatCard label="Net" value={formatMoney(income - expense)} tone={income - expense >= 0 ? "good" : "bad"} />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Income vs expense</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={trend ?? []} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke={chrome.gridline} />
            <XAxis dataKey="label" tick={{ fill: chrome.mutedInk, fontSize: 12 }} axisLine={{ stroke: chrome.baseline }} tickLine={false} />
            <YAxis tick={{ fill: chrome.mutedInk, fontSize: 12 }} axisLine={false} tickLine={false} width={80} tickFormatter={(v) => formatMoney(v)} />
            <Tooltip content={<ChartTooltip currency="INR" />} cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: chrome.secondaryInk }} />
            <Bar dataKey="income" name="Income" fill={diverging.positive} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="expense" name="Expense" fill={diverging.negative} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
        {(trend?.length ?? 0) === 0 && <p className="py-6 text-center text-sm text-slate-500">No transactions in range yet.</p>}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Spending by category{selectedMonth ? ` — ${currentPeriod?.label ?? ""}` : ""}
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(120, breakdownWithOther.length * 36)}>
          <BarChart data={breakdownWithOther} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid horizontal={false} stroke={chrome.gridline} />
            <XAxis type="number" tick={{ fill: chrome.mutedInk, fontSize: 12 }} axisLine={{ stroke: chrome.baseline }} tickLine={false} tickFormatter={(v) => formatMoney(v)} />
            <YAxis type="category" dataKey="name" tick={{ fill: chrome.secondaryInk, fontSize: 12 }} axisLine={false} tickLine={false} width={140} />
            <Tooltip content={<ChartTooltip currency="INR" />} cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="total" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {breakdownWithOther.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {breakdownWithOther.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No expenses in range yet.</p>}
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Balances by account & group</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {balances?.map((a) => (
            <Card key={a.id}>
              <p className="font-medium text-slate-900 dark:text-white">{a.name}</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(a.balance, a.currency)}</p>
              {a.groups.length > 1 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                  {a.groups.map((g) => (
                    <li key={g.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: g.color ?? "#94a3b8" }} />
                        {g.name}
                      </span>
                      <span>{formatMoney(g.balance, a.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const toneClass = tone === "good" ? "text-green-600 dark:text-green-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white";
  return (
    <Card>
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </Card>
  );
}

function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {label && <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium text-slate-900 dark:text-white">{formatMoney(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}
