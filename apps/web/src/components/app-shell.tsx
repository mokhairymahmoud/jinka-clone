"use client";

import { usePathname } from "next/navigation";

import type { SessionUser } from "../lib/session";
import { AdminShell } from "./admin-shell";
import { CustomerShell } from "./customer-shell";

export function AppShell({
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
  const inAdmin = pathname?.startsWith(`/${locale}/admin`);

  if (inAdmin && (user.role === "admin" || user.role === "ops_reviewer")) {
    return (
      <AdminShell locale={locale} labels={labels} user={user}>
        {children}
      </AdminShell>
    );
  }

  return (
    <CustomerShell locale={locale} labels={labels} user={user}>
      {children}
    </CustomerShell>
  );
}
