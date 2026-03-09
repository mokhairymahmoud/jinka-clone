import { cookies } from "next/headers";

import { apiFetch } from "./api";

export async function getAccessTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value ?? null;
}

export async function authenticatedApiFetch(path: string, init?: RequestInit) {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return null;
  }

  return apiFetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${accessToken}`
    }
  });
}
