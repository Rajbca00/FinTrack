import type { ReactNode } from "react";
import clsx from "clsx";
import { formatMoney } from "../lib/format";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-2xl border border-hairline bg-surface p-5 shadow-lg shadow-black/20", className)}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const toneClass = tone === "good" ? "text-good" : tone === "bad" ? "text-critical" : "text-ink";
  return (
    <Card className="min-w-0">
      <p className="truncate text-xs font-medium uppercase text-ink-muted">{label}</p>
      <p className={`mt-1 break-words text-2xl font-semibold ${toneClass}`}>{value}</p>
    </Card>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-hover disabled:bg-brand/40",
    secondary: "bg-black/5 text-ink hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
    danger: "bg-critical/10 text-critical hover:bg-critical/15",
    ghost: "text-ink-secondary hover:bg-black/5 dark:hover:bg-white/5",
  }[variant];
  return (
    <button
      className={clsx(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed active:scale-[0.97]",
        styles,
        className
      )}
      {...props}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-lg border border-hairline-strong bg-white/[0.03] px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-lg border border-hairline-strong bg-white/[0.03] px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none",
        props.className
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-ink-muted">{children}</label>;
}

export function Badge({ color, children }: { color?: string | null; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-xs font-medium text-ink-secondary">
      <span className="h-2 w-2 rounded-full" style={{ background: color ?? "#898781" }} />
      {children}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={clsx(
          "animate-sheet-in sm:animate-modal-in max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface p-6 shadow-2xl shadow-black/40 sm:rounded-2xl sm:border",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="-mr-1.5 -mt-1.5 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {title && <p className="text-sm font-semibold text-ink">{title}</p>}
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-muted/40 border-t-brand" />
      {label}
    </div>
  );
}

export function Toast({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 sm:bottom-6">
      <div className="animate-toast-in flex items-center gap-3 rounded-full border border-hairline-strong bg-surface px-4 py-2 text-sm text-ink shadow-2xl shadow-black/40">
        <span>{message}</span>
        {actionLabel && onAction && (
          <button className="font-semibold text-brand hover:underline" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: color ?? "var(--color-brand)" }} />
    </div>
  );
}

// Shared recharts tooltip - used by any chart across the app so styling
// only needs to be kept theme-aware (light/dark pairs) in one place.
export function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  currency?: string;
}) {
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
