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
      className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
    >
      Sign out
    </button>
  );
}
