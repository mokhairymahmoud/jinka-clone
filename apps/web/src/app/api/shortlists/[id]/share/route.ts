import { NextResponse } from "next/server";

import { authenticatedApiFetch } from "../../../../../lib/server-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await authenticatedApiFetch(
    `/v1/shortlists/${id}/share`,
    {
      method: "POST",
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
