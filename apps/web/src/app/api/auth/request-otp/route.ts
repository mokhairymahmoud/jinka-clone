import { NextResponse } from "next/server";

import { apiFetch } from "../../../../lib/api";

export async function POST(request: Request) {
  const body = await request.json();
  const response = await apiFetch("/v1/auth/email/request-otp", {
    method: "POST",
    body: JSON.stringify(body)
  });
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
