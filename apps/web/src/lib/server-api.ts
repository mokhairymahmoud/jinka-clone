import { cookies } from "next/headers";

import { apiFetch } from "./api";
import {
  authCookieOptions,
  getCookieValueFromSetCookieHeaders,
  getExpiredAuthCookieOptions,
  getSetCookieHeaders,
  isJwtExpired
} from "./auth";

type RefreshSessionResult = {
  accessToken: string;
  refreshToken: string;
};

async function persistAuthCookies(tokens: RefreshSessionResult) {
  const cookieStore = await cookies();
  cookieStore.set("access_token", tokens.accessToken, authCookieOptions);
  cookieStore.set("refresh_token", tokens.refreshToken, authCookieOptions);
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  const expiredOptions = getExpiredAuthCookieOptions();
  cookieStore.set("access_token", "", expiredOptions);
  cookieStore.set("refresh_token", "", expiredOptions);
}

export async function refreshSession(options?: { persistCookies?: boolean }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    if (options?.persistCookies) {
      await clearAuthCookies();
    }
    return null;
  }

  const response = await apiFetch("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    if (options?.persistCookies) {
      await clearAuthCookies();
    }
    return null;
  }

  const setCookieHeaders = getSetCookieHeaders(response);
  const nextAccessToken = getCookieValueFromSetCookieHeaders(setCookieHeaders, "access_token");
  const nextRefreshToken =
    getCookieValueFromSetCookieHeaders(setCookieHeaders, "refresh_token") ?? refreshToken;

  if (!nextAccessToken) {
    if (options?.persistCookies) {
      await clearAuthCookies();
    }
    return null;
  }

  const tokens = {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken
  };

  if (options?.persistCookies) {
    await persistAuthCookies(tokens);
  }

  return tokens;
}

export async function getAccessTokenFromCookies(options?: { allowRefresh?: boolean; persistRefresh?: boolean }) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value ?? null;

  if (accessToken && !isJwtExpired(accessToken)) {
    return accessToken;
  }

  if (options?.allowRefresh === false) {
    return accessToken;
  }

  const refreshed = await refreshSession({ persistCookies: options?.persistRefresh });
  return refreshed?.accessToken ?? null;
}

export async function authenticatedApiFetch(
  path: string,
  init?: RequestInit,
  options?: { persistRefresh?: boolean }
) {
  let accessToken = await getAccessTokenFromCookies({
    persistRefresh: options?.persistRefresh
  });

  if (!accessToken) {
    return null;
  }

  const buildRequest = (token: string) =>
    apiFetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        authorization: `Bearer ${token}`
      }
    });

  const response = await buildRequest(accessToken);

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSession({ persistCookies: options?.persistRefresh });

  if (!refreshed || refreshed.accessToken === accessToken) {
    return null;
  }

  accessToken = refreshed.accessToken;

  return buildRequest(accessToken);
}
