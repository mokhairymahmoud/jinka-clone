import { NextResponse } from "next/server";

import { authenticatedApiFetch } from "../../../lib/server-api";

export async function POST(request: Request) {
  const response = await authenticatedApiFetch("/v1/reports", {
    method: "POST",
    body: await request.text()
  });

  if (!response) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
