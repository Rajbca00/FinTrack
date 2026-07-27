import type { ReactNode } from "react";
import clsx from "clsx";

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
      className={clsx("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed", styles, className)}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={clsx(
          "max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-hairline bg-surface p-6 shadow-2xl shadow-black/40",
          wide ? "max-w-2xl" : "max-w-md"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
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
      <div className="flex items-center gap-3 rounded-full border border-hairline-strong bg-surface px-4 py-2 text-sm text-ink shadow-2xl shadow-black/40">
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
