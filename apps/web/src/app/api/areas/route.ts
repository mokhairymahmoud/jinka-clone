import { NextResponse } from "next/server";

import { apiFetch } from "../../../lib/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const response = await apiFetch(`/v1/areas${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
