"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, LayoutGrid, Shield, UserRound } from "lucide-react";

import { cn } from "@jinka-eg/ui";

import type { SessionUser } from "../lib/session";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoutButton } from "./logout-button";

function getPageTitle(pathname: string | null, labels: Record<string, string>) {
  if (!pathname) return labels.navAlerts;
  if (pathname.includes("/inbox")) return labels.navInbox;
  if (pathname.includes("/account")) return labels.navAccount;
  if (pathname.includes("/listing/")) return "Matched listing";
  if (pathname.includes("/search/")) return "Create alert";
  return labels.navAlerts;
}

const customerNav = [
  { href: "alerts", key: "navAlerts", icon: BellRing },
  { href: "inbox", key: "navInbox", icon: LayoutGrid },
  { href: "account", key: "navAccount", icon: UserRound }
] as const;

export function CustomerShell({
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
  const pageTitle = getPageTitle(pathname, labels);

  return (
    <div className="min-h-screen bg-[var(--jinka-background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--jinka-border)] bg-[rgba(244,243,240,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--jinka-muted)]">{labels.brand}</div>
            <div className="truncate text-lg font-semibold text-[var(--jinka-text)]">{pageTitle}</div>
          </div>
          <div className="flex items-center gap-2">
            {(user.role === "admin" || user.role === "ops_reviewer") && (
              <Link
                href={`/${locale}/admin`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-3 py-2 text-sm font-semibold text-[var(--jinka-text)] shadow-[var(--jinka-shadow)]"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            <LocaleSwitcher locale={locale} />
            <LogoutButton locale={locale} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-5 sm:px-6">{children}</main>
      <nav className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl items-center justify-between rounded-[26px] border border-[var(--jinka-border)] bg-[rgba(255,255,255,0.96)] p-2 shadow-[var(--jinka-shadow)] backdrop-blur">
        {customerNav.map((item) => {
          const active = pathname?.startsWith(`/${locale}/${item.href}`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={`/${locale}/${item.href}`}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-3 py-2 text-xs font-semibold transition",
                active ? "bg-[var(--jinka-accent-soft)] text-[var(--jinka-accent)]" : "text-[var(--jinka-muted)]"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{labels[item.key]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
