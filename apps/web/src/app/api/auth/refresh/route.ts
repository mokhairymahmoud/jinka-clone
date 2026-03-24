import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { appendSetCookieHeaders, getExpiredAuthCookieOptions } from "../../../../lib/auth";
import { apiFetch } from "../../../../lib/api";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    const response = NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    const expiredOptions = getExpiredAuthCookieOptions();
    response.cookies.set("access_token", "", expiredOptions);
    response.cookies.set("refresh_token", "", expiredOptions);
    return response;
  }

  const apiResponse = await apiFetch("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
  const payload = await apiResponse.json();
  const response = NextResponse.json(payload, { status: apiResponse.status });

  if (apiResponse.ok) {
    appendSetCookieHeaders(response.headers, apiResponse);
  } else {
    const expiredOptions = getExpiredAuthCookieOptions();
    response.cookies.set("access_token", "", expiredOptions);
    response.cookies.set("refresh_token", "", expiredOptions);
  }

  return response;
}
