import { NextResponse } from "next/server";

import { apiFetch } from "../../../../lib/api";

export async function GET() {
  const response = await apiFetch("/v1/push-subscriptions/public-key");
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
