import { NextResponse } from "next/server";

import { apiFetch } from "../../../lib/api";
import { getAccessTokenFromCookies } from "../../../lib/server-api";

export async function GET() {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const response = await apiFetch("/v1/me", {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}

export async function PATCH(request: Request) {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json();
  const response = await apiFetch("/v1/me", {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
