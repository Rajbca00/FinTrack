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
import { useAccounts, useBalances, useBreakdown, useCategoryTrend, useTrend } from "../hooks/useApi";
import { Card, Select, Label } from "../components/ui";
import { formatMoney } from "../lib/format";
import { CHROME, DIVERGING, categoricalColor } from "../lib/palette";

type Period = "week" | "month" | "year";

export function Dashboard() {
  const chrome = CHROME;
  const diverging = DIVERGING.dark;

  const { data: accounts } = useAccounts();
  const { data: balances } = useBalances();
  const [period, setPeriod] = useState<Period>("month");
  const [accountId, setAccountId] = useState("");
  // Filters the report sections (trend/breakdown/category-trend) below by
  // group *name* rather than a single group id, since a name like "General"
  // exists once per account - defaults to "General" so a Temple Fund-style
  // secondary group doesn't silently skew the main financial reports.
  const [groupName, setGroupName] = useState("General");
  // Only meaningful when period === "month" - lets the charts narrow down to
  // one specific month instead of showing the whole transaction history.
  const [selectedMonth, setSelectedMonth] = useState("");

  const groupNames = useMemo(() => {
    const names = new Set<string>();
    accounts?.forEach((a) => a.groups.forEach((g) => names.add(g.name)));
    return Array.from(names).sort();
  }, [accounts]);

  // The report queries take an array of ids (every group across accounts
  // sharing this name), narrowed further to just the selected account's
  // matching group if one is chosen. Undefined ("All groups") applies no
  // group filter at all.
  const reportGroupIds = useMemo(() => {
    if (!groupName) return undefined;
    const scope = accountId ? accounts?.filter((a) => a.id === accountId) : accounts;
    return scope?.flatMap((a) => a.groups.filter((g) => g.name === groupName).map((g) => g.id));
  }, [groupName, accountId, accounts]);

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
    groupId: reportGroupIds,
    ...monthRange,
  });
  const { data: breakdown } = useBreakdown({
    type: "EXPENSE",
    accountId: accountId || undefined,
    groupId: reportGroupIds,
    ...monthRange,
  });

  // Runs independently of the Period/Month pickers above (those narrow
  // everything else to one window) - "month on month" only means something
  // as its own range. "current"/"last" are single-month windows; the rest
  // are trailing windows ending at the current month.
  const [categoryTrendPreset, setCategoryTrendPreset] = useState<"current" | "last" | "3" | "6" | "12">("6");
  const categoryTrendRange = useMemo(() => {
    const now = new Date();
    const endMonthOffset = categoryTrendPreset === "last" ? -1 : 0;
    const startMonthOffset =
      categoryTrendPreset === "current" || categoryTrendPreset === "last" ? endMonthOffset : endMonthOffset - (Number(categoryTrendPreset) - 1);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + startMonthOffset, 1)).toISOString();
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + endMonthOffset + 1, 0, 23, 59, 59, 999)).toISOString();
    return { from, to };
  }, [categoryTrendPreset]);
  const { data: categoryTrend } = useCategoryTrend({
    type: "EXPENSE",
    accountId: accountId || undefined,
    groupId: reportGroupIds,
    ...categoryTrendRange,
  });

  // Mirrors the Account/Group filters above (and reportGroupIds, which the
  // trend/breakdown queries already use) so "Total balance" doesn't silently
  // stay account-wide while every other stat on the page is scoped down.
  const totalBalance = useMemo(() => {
    if (!balances) return 0;
    if (reportGroupIds) {
      const groupIds = new Set(reportGroupIds);
      return balances.reduce(
        (sum, a) => sum + a.groups.filter((g) => groupIds.has(g.id)).reduce((s, g) => s + g.balance, 0),
        0
      );
    }
    const scope = accountId ? balances.filter((a) => a.id === accountId) : balances;
    return scope.reduce((sum, a) => sum + a.balance, 0);
  }, [balances, accountId, reportGroupIds]);

  // Groups are scoped to a single account in the data model (no cross-account
  // group exists), so this rolls up same-named groups across accounts for
  // display purposes only - e.g. a "Temple Fund" group in two different bank
  // accounts shows here as one combined total, without changing how either
  // group is actually stored or edited.
  const fundsAcrossAccounts = useMemo(() => {
    if (!balances) return [];
    const byName = new Map<
      string,
      { name: string; color: string | null; total: number; accounts: { name: string; balance: number; currency: string }[] }
    >();
    for (const acc of balances) {
      for (const g of acc.groups) {
        const entry = byName.get(g.name) ?? { name: g.name, color: g.color, total: 0, accounts: [] };
        entry.total += g.balance;
        entry.accounts.push({ name: acc.name, balance: g.balance, currency: acc.currency });
        byName.set(g.name, entry);
      }
    }
    return Array.from(byName.values())
      .filter((f) => f.accounts.length > 1)
      .map((f) => ({
        ...f,
        // Summing across currencies would be meaningless, so only show a
        // combined total when every contributing account shares one.
        currency: f.accounts.every((a) => a.currency === f.accounts[0].currency) ? f.accounts[0].currency : null,
      }));
  }, [balances]);
  const currentPeriod = trend?.[trend.length - 1];
  const income = currentPeriod?.income ?? 0;
  const expense = currentPeriod?.expense ?? 0;

  const breakdownWithOther = useMemo(() => {
    if (!breakdown) return [];
    const top = breakdown.slice(0, 8);
    const rest = breakdown.slice(8);
    const otherTotal = rest.reduce((s, b) => s + b.total, 0);
    const items = top.map((b, i) => ({ ...b, color: categoricalColor(i) }));
    if (otherTotal > 0) items.push({ categoryId: "other", name: "Other", color: chrome.mutedInk, total: otherTotal });
    return items;
  }, [breakdown, chrome.mutedInk]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted">An overview of your money across accounts and funds.</p>
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
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All accounts</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-56">
          <Label>Group</Label>
          <Select value={groupName} onChange={(e) => setGroupName(e.target.value)}>
            <option value="">All groups</option>
            {groupNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total balance" value={formatMoney(totalBalance)} />
        <StatCard label={`Income (${currentPeriod?.label ?? "this period"})`} value={formatMoney(income)} tone="good" />
        <StatCard label={`Expense (${currentPeriod?.label ?? "this period"})`} value={formatMoney(expense)} tone="bad" />
        <StatCard label="Net" value={formatMoney(income - expense)} tone={income - expense >= 0 ? "good" : "bad"} />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink-secondary">Income vs expense</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={trend ?? []} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke={chrome.gridline} />
            <XAxis dataKey="label" tick={{ fill: chrome.mutedInk, fontSize: 12 }} axisLine={{ stroke: chrome.baseline }} tickLine={false} />
            <YAxis tick={{ fill: chrome.mutedInk, fontSize: 12 }} axisLine={false} tickLine={false} width={80} tickFormatter={(v) => formatMoney(v)} />
            <Tooltip content={<ChartTooltip currency="INR" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: chrome.secondaryInk }} />
            <Bar dataKey="income" name="Income" fill={diverging.positive} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="expense" name="Expense" fill={diverging.negative} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
        {(trend?.length ?? 0) === 0 && <p className="py-6 text-center text-sm text-ink-muted">No transactions in range yet.</p>}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink-secondary">
          Spending by category{selectedMonth ? ` — ${currentPeriod?.label ?? ""}` : ""}
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(120, breakdownWithOther.length * 36)}>
          <BarChart data={breakdownWithOther} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid horizontal={false} stroke={chrome.gridline} />
            <XAxis type="number" tick={{ fill: chrome.mutedInk, fontSize: 12 }} axisLine={{ stroke: chrome.baseline }} tickLine={false} tickFormatter={(v) => formatMoney(v)} />
            <YAxis type="category" dataKey="name" tick={{ fill: chrome.secondaryInk, fontSize: 12 }} axisLine={false} tickLine={false} width={140} />
            <Tooltip content={<ChartTooltip currency="INR" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="total" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {breakdownWithOther.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {breakdownWithOther.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No expenses in range yet.</p>}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-secondary">Category spend by month</h2>
          <Select
            className="w-auto"
            value={categoryTrendPreset}
            onChange={(e) => setCategoryTrendPreset(e.target.value as typeof categoryTrendPreset)}
          >
            <option value="current">Current month</option>
            <option value="last">Last month</option>
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-muted dark:bg-white/5 dark:text-ink-muted">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Category</th>
                {categoryTrend?.months.map((m) => (
                  <th key={m.key} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                    {m.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-hairline">
              {categoryTrend?.rows.map((r) => (
                <tr key={r.categoryId}>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: r.color ?? "#94a3b8" }} />
                      {r.name}
                    </span>
                  </td>
                  {r.totals.map((v, i) => (
                    <td key={categoryTrend.months[i].key} className="whitespace-nowrap px-3 py-2 text-right text-ink-secondary">
                      {v > 0 ? formatMoney(v) : "—"}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-ink">
                    {formatMoney(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            {categoryTrend && categoryTrend.months.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold dark:border-hairline">
                  <td className="whitespace-nowrap px-3 py-2">Total</td>
                  {categoryTrend.months.map((m, i) => (
                    <td key={m.key} className="whitespace-nowrap px-3 py-2 text-right">
                      {formatMoney(categoryTrend.rows.reduce((s, r) => s + r.totals[i], 0))}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatMoney(categoryTrend.rows.reduce((s, r) => s + r.total, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {(categoryTrend?.rows.length ?? 0) === 0 && <p className="py-6 text-center text-sm text-ink-muted">No expenses in range yet.</p>}
      </Card>

      {fundsAcrossAccounts.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Funds across accounts</h2>
          <p className="mb-2 text-xs text-ink-muted">
            Groups that share a name in more than one account, combined here for reference. Each is still a separate
            group with its own balance - use Transfers → Reallocate to move money between them within an account.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fundsAcrossAccounts.map((f) => (
              <Card key={f.name}>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: f.color ?? "#94a3b8" }} />
                  <p className="font-medium text-ink">{f.name}</p>
                </div>
                <p className="text-xl font-semibold text-ink">
                  {f.currency ? formatMoney(f.total, f.currency) : "Mixed currencies"}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
                  {f.accounts.map((a) => (
                    <li key={a.name} className="flex items-center justify-between">
                      <span>{a.name}</span>
                      <span>{formatMoney(a.balance, a.currency)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">Balances by account & group</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {balances?.map((a) => (
            <Card key={a.id}>
              <p className="font-medium text-ink">{a.name}</p>
              <p className="text-xl font-semibold text-ink">{formatMoney(a.balance, a.currency)}</p>
              {a.groups.length > 1 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
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
  const toneClass = tone === "good" ? "text-good" : tone === "bad" ? "text-critical" : "text-ink";
  return (
    <Card>
      <p className="text-xs font-medium uppercase text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </Card>
  );
}

function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-hairline-strong dark:bg-surface">
      {label && <p className="mb-1 font-medium text-ink-secondary">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium text-ink">{formatMoney(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}
