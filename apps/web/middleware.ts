import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { appLocales } from "@jinka-eg/config";
import {
  authCookieOptions,
  getCookieValueFromSetCookieHeaders,
  getExpiredAuthCookieOptions,
  getSetCookieHeaders,
  isJwtExpired
} from "./src/lib/auth";
import { getApiBaseUrl } from "./src/lib/api";

const intlMiddleware = createMiddleware({
  locales: [...appLocales],
  defaultLocale: "en",
  localePrefix: "always"
});

const protectedPrefixes = ["/search", "/listing", "/project", "/alerts", "/favorites", "/shortlists", "/account", "/admin", "/inbox"];

async function refreshRequestSession(refreshToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const setCookieHeaders = getSetCookieHeaders(response);
  const accessToken = getCookieValueFromSetCookieHeaders(setCookieHeaders, "access_token");
  const nextRefreshToken =
    getCookieValueFromSetCookieHeaders(setCookieHeaders, "refresh_token") ?? refreshToken;

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken: nextRefreshToken
  };
}

export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const [, maybeLocale, ...rest] = request.nextUrl.pathname.split("/");
  const locale = appLocales.includes(maybeLocale as (typeof appLocales)[number]) ? maybeLocale : "en";
  const subPath = `/${rest.join("/")}`;
  const accessToken = request.cookies.get("access_token")?.value ?? null;
  const refreshToken = request.cookies.get("refresh_token")?.value ?? null;
  const isProtected = protectedPrefixes.some((prefix) => subPath === prefix || subPath.startsWith(`${prefix}/`));

  if (isProtected) {
    if (accessToken && !isJwtExpired(accessToken)) {
      return response;
    }

    if (refreshToken) {
      const refreshed = await refreshRequestSession(refreshToken);

      if (refreshed) {
        response.cookies.set("access_token", refreshed.accessToken, authCookieOptions);
        response.cookies.set("refresh_token", refreshed.refreshToken, authCookieOptions);
        return response;
      }
    }

    const redirectResponse = NextResponse.redirect(new URL(`/${locale}/sign-in`, request.url));
    const expiredOptions = getExpiredAuthCookieOptions();
    redirectResponse.cookies.set("access_token", "", expiredOptions);
    redirectResponse.cookies.set("refresh_token", "", expiredOptions);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};
