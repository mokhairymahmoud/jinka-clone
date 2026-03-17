"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, House, Shield, UserRound } from "lucide-react";

import { cn } from "@jinka-eg/ui";

import type { SessionUser } from "../lib/session";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoutButton } from "./logout-button";

const adminNav = [
  { href: "admin", labelKey: "admin", icon: Shield },
  { href: "alerts", labelKey: "navAlerts", icon: BellRing },
  { href: "account", labelKey: "navAccount", icon: UserRound }
] as const;

export function AdminShell({
  locale,
  labels,
  user,
  children
}: {
  locale: "en" | "ar";
  labels: Record<string, string>;
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--jinka-background)]">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 lg:grid-cols-[280px_1fr] lg:px-6">
        <aside className="rounded-[32px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-5 shadow-[var(--jinka-shadow)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--jinka-muted)]">{labels.brand}</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--jinka-text)]">Admin</div>
              <p className="mt-2 text-sm text-[var(--jinka-muted)]">Inherited from the customer experience, adapted for operations.</p>
            </div>
            <LocaleSwitcher locale={locale} />
          </div>
          <div className="mt-6 rounded-[24px] bg-[var(--jinka-surface-muted)] p-4">
            <div className="text-sm font-semibold text-[var(--jinka-text)]">{user.name ?? user.email}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--jinka-muted)]">{user.role}</div>
          </div>
          <nav className="mt-6 grid gap-2">
            {adminNav.map((item) => {
              const active = pathname?.startsWith(`/${locale}/${item.href}`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={`/${locale}/${item.href}`}
                  className={cn(
                    "flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-semibold transition",
                    active ? "bg-[var(--jinka-accent-soft)] text-[var(--jinka-accent)]" : "text-[var(--jinka-text)] hover:bg-[var(--jinka-surface-muted)]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {labels[item.labelKey]}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={`/${locale}/alerts`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--jinka-text)]"
            >
              <House className="h-4 w-4" />
              Customer view
            </Link>
            <LogoutButton locale={locale} />
          </div>
        </aside>
        <main className="rounded-[32px] border border-[var(--jinka-border)] bg-[var(--jinka-surface)] p-5 shadow-[var(--jinka-shadow)] lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
