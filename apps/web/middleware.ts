import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { appLocales } from "@jinka-eg/config";

const intlMiddleware = createMiddleware({
  locales: [...appLocales],
  defaultLocale: "en",
  localePrefix: "always"
});

const protectedPrefixes = ["/search", "/listing", "/project", "/alerts", "/favorites", "/shortlists", "/account", "/admin", "/inbox"];

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const [, maybeLocale, ...rest] = request.nextUrl.pathname.split("/");
  const locale = appLocales.includes(maybeLocale as (typeof appLocales)[number]) ? maybeLocale : "en";
  const subPath = `/${rest.join("/")}`;
  const hasAccessToken = Boolean(request.cookies.get("access_token")?.value);
  const isProtected = protectedPrefixes.some((prefix) => subPath === prefix || subPath.startsWith(`${prefix}/`));
  const isSignIn = subPath === "/sign-in";

  if (isProtected && !hasAccessToken) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, request.url));
  }

  if (isSignIn && hasAccessToken) {
    return NextResponse.redirect(new URL(`/${locale}/search/units`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};
