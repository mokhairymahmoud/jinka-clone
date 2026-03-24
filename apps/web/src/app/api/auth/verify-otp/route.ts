import { NextResponse } from "next/server";

import { appendSetCookieHeaders } from "../../../../lib/auth";
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
    appendSetCookieHeaders(nextResponse.headers, response);
  }

  return nextResponse;
}
