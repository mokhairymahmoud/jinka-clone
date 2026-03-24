import { NextResponse } from "next/server";

import { authenticatedApiFetch } from "../../../lib/server-api";

export async function GET() {
  const response = await authenticatedApiFetch("/v1/me", undefined, {
    persistRefresh: true
  });

  if (!response) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}

export async function PATCH(request: Request) {
  const response = await authenticatedApiFetch(
    "/v1/me",
    {
      method: "PATCH",
      body: await request.text()
    },
    {
      persistRefresh: true
    }
  );

  if (!response) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
