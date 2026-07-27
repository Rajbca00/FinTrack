import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";

// `primary: true` marks the handful of items that also get a slot in the
// mobile bottom tab bar (which only has room for a few before it feels
// cramped) - everything else still shows in the tab bar's "More" sheet and
// in the desktop sidebar (which scales vertically, so it lists everything
// flat regardless of this flag).
const NAV_ITEMS = [
  { to: "/", label: "Dashboard", tabLabel: "Home", end: true, icon: IconHome, primary: true },
  { to: "/net-worth", label: "Net Worth", tabLabel: "Net Worth", icon: IconTrendUp, primary: true },
  { to: "/goals", label: "Goals", tabLabel: "Goals", icon: IconFlag, primary: false },
  { to: "/budgets", label: "Budgets", tabLabel: "Budgets", icon: IconPie, primary: false },
  { to: "/bills", label: "Bills", tabLabel: "Bills", icon: IconCalendar, primary: false },
  { to: "/accounts", label: "Accounts", tabLabel: "Accounts", icon: IconBank, primary: true },
  { to: "/transactions", label: "Transactions", tabLabel: "Activity", icon: IconList, primary: true },
  { to: "/transfers", label: "Transfers", tabLabel: "Transfers", icon: IconSwap, primary: false },
  { to: "/categories", label: "Categories & Rules", tabLabel: "Categories", icon: IconTag, primary: false },
  { to: "/settings", label: "Settings", tabLabel: "Settings", icon: IconGear, primary: false },
];

const mobilePrimaryItems = NAV_ITEMS.filter((i) => i.primary);
const mobileOverflowItems = NAV_ITEMS.filter((i) => !i.primary);

const STORAGE_KEY = "fintrack.sidebarCollapsed";

export function Layout() {
  // Icon-rail collapse, desktop only - the mobile bottom tab bar replaces
  // the sidebar entirely below md, so collapsing has nothing to do there.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setShowMore(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen md:flex">
      <aside
        className={clsx(
          "sticky top-0 hidden h-screen shrink-0 border-r border-hairline bg-surface py-6 md:flex md:flex-col",
          collapsed ? "md:w-16 md:px-2" : "md:w-60 md:px-4"
        )}
      >
        <div className={clsx("mb-8 flex items-center", collapsed ? "justify-center px-0" : "justify-between px-2")}>
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="rounded-lg"
            >
              <Logo className="h-8 w-8" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Logo className="h-8 w-8 shrink-0" />
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-ink">FinTrack</h1>
                  <p className="text-xs text-ink-muted">Personal finance manager</p>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="rounded-lg p-1.5 text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
              >
                <IconChevron collapsed={collapsed} />
              </button>
            </>
          )}
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive ? "bg-brand/15 text-brand" : "text-ink-secondary hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-x-hidden px-4 pb-24 pt-6 md:px-8 md:pb-6">
        <div key={location.pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>

      {showMore && (
        <div
          className="animate-overlay-in fixed inset-0 z-40 flex items-end bg-black/60 md:hidden"
          onClick={() => setShowMore(false)}
        >
          <div
            className="animate-sheet-in w-full rounded-t-2xl border-t border-hairline bg-surface p-4 pb-8"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">More</h2>
              <button onClick={() => setShowMore(false)} className="text-ink-muted hover:text-ink" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {mobileOverflowItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive ? "bg-brand/15 text-brand" : "text-ink-secondary hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-hairline bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {mobilePrimaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                isActive ? "text-brand" : "text-ink-muted"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.tabLabel}</span>
          </NavLink>
        ))}
        {mobileOverflowItems.length > 0 && (
          <button
            onClick={() => setShowMore(true)}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              mobileOverflowItems.some((i) => i.to === location.pathname) ? "text-brand" : "text-ink-muted"
            )}
          >
            <IconMore className="h-5 w-5" />
            <span>More</span>
          </button>
        )}
      </nav>
    </div>
  );
}

type IconProps = { className?: string };

function Logo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="fintrackLogoBg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7e14ff" />
          <stop offset="1" stopColor="#47bfff" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11" fill="url(#fintrackLogoBg)" />
      <rect x="4" y="25" width="17" height="14" rx="3.5" fill="#fff" />
      <circle cx="21" cy="32" r="2.2" fill="#7e14ff" />
      <rect x="25" y="30" width="4.5" height="10" rx="1.4" fill="#fff" />
      <rect x="32" y="22" width="4.5" height="18" rx="1.4" fill="#fff" />
      <rect x="39" y="14" width="4.5" height="26" rx="1.4" fill="#fff" />
    </svg>
  );
}

function IconChevron({ collapsed, className }: IconProps & { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={clsx("h-4 w-4", className)}>
      <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
    </svg>
  );
}

function IconHome({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function IconTrendUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17 9 11l4 4 8-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h6v6" />
    </svg>
  );
}

function IconFlag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h13l-3 4 3 4H5" />
    </svg>
  );
}

function IconMore({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

function IconPie({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v9l7.5 4.3A9 9 0 1 1 12 3Z" />
    </svg>
  );
}

function IconCalendar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconGear({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      />
    </svg>
  );
}

function IconBank({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10 12 4l9 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v9M10 10v9M14 10v9M19 10v9M3 19h18" />
    </svg>
  );
}

function IconList({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function IconSwap({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v13M7 17l-3-3M7 17l3-3M17 20V7M17 7l-3 3M17 7l3 3" />
    </svg>
  );
}

function IconTag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.59 9.59a2 2 0 0 0 2.83 0l4.34-4.34a2 2 0 0 0 0-2.83Z"
      />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
