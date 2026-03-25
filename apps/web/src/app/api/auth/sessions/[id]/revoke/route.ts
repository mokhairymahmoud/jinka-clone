import { NextResponse } from "next/server";

import { authenticatedApiFetch } from "../../../../../../lib/server-api";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const response = await authenticatedApiFetch(
    `/v1/auth/sessions/${encodeURIComponent(id)}/revoke`,
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
