import { NextResponse } from "next/server";

import { authenticatedApiFetch } from "../../../../../lib/server-api";

export async function POST() {
  const response = await authenticatedApiFetch(
    "/v1/auth/sessions/revoke-others",
    {
      method: "POST"
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
