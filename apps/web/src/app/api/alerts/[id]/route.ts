import { NextResponse } from "next/server";

import { authenticatedApiFetch } from "../../../../lib/server-api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await authenticatedApiFetch(`/v1/alerts/${id}`, {
    method: "DELETE"
  });

  if (!response) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
