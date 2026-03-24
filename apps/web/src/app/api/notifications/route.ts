import { NextResponse } from "next/server";

import { authenticatedApiFetch } from "../../../lib/server-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const alertId = url.searchParams.get("alertId");
  const response = await authenticatedApiFetch(
    `/v1/notifications${alertId ? `?alertId=${encodeURIComponent(alertId)}` : ""}`,
    undefined,
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
