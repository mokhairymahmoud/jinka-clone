import { NextResponse } from "next/server";

import { apiFetch } from "../../../../lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  const response = await apiFetch("/v1/auth/email/verify-otp", {
    method: "POST",
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  const nextResponse = NextResponse.json(payload, { status: response.status });

  if (response.ok) {
    nextResponse.cookies.set("access_token", payload.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    nextResponse.cookies.set("refresh_token", payload.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
  }

  return nextResponse;
}
