import { NextResponse } from "next/server";

import { authenticatedApiFetch } from "../../../../lib/server-api";

function buildPath(segments: string[]) {
  return `/v1/admin/${segments.join("/")}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const response = await authenticatedApiFetch(
    buildPath(segments),
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

export async function DELETE(request: Request, { params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const response = await authenticatedApiFetch(
    buildPath(segments),
    {
      method: "DELETE",
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
