import Link from "next/link";

import { LocaleSwitcher } from "./locale-switcher";

const navItems = [
  { href: "search/units", key: "navSearch" },
  { href: "alerts", key: "navAlerts" },
  { href: "favorites", key: "navFavorites" },
  { href: "inbox", key: "navInbox" },
  { href: "account", key: "navAccount" },
  { href: "admin", key: "admin" }
] as const;

export function AppShell({
  locale,
  labels,
  children
}: {
  locale: "en" | "ar";
  labels: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-[2rem] border border-stone-200/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between lg:block">
            <div>
              <div className="font-display text-lg font-bold text-stone-950">{labels.brand}</div>
              <p className="mt-1 text-sm text-stone-500">Aggregator workspace</p>
            </div>
            <LocaleSwitcher locale={locale} />
          </div>
          <nav className="mt-6 grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}/${item.href}`}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
              >
                {labels[item.key]}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="rounded-[2rem] border border-stone-200/80 bg-white/80 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.05)]">
          {children}
        </main>
      </div>
    </div>
  );
}
