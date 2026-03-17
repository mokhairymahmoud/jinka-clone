"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ locale }: { locale: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST"
    });

    router.push(`/${locale}/sign-in`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-3 py-1.5 text-sm font-medium text-[var(--jinka-muted)] transition hover:bg-[var(--jinka-surface-muted)]"
    >
      Sign out
    </button>
  );
}
