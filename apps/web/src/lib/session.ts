import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiFetch } from "./api";
import { refreshSession } from "./server-api";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  role: "user" | "ops_reviewer" | "admin";
  notificationPrefs: {
    emailEnabled?: boolean;
    pushEnabled?: boolean;
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (accessToken) {
    const response = await apiFetch("/v1/me", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    if (response.ok) {
      return (await response.json()) as SessionUser;
    }
  }

  const refreshed = await refreshSession();

  if (!refreshed) {
    return null;
  }

  const response = await apiFetch("/v1/me", {
    headers: {
      authorization: `Bearer ${refreshed.accessToken}`
    }
  });

  return response.ok ? ((await response.json()) as SessionUser) : null;
}

export async function requireSessionUser(locale: string) {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/sign-in`);
  }

  return user;
}
