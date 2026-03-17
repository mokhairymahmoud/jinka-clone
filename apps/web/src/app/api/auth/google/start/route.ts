import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  params.set("locale", url.searchParams.get("locale") ?? "en");
  params.set("returnTo", url.searchParams.get("returnTo") ?? `/${params.get("locale")}/search/units`);

  const response = await apiFetch(`/v1/auth/google/start?${params.toString()}`);

  if (!response.ok) {
    return NextResponse.redirect(new URL(`/${params.get("locale")}/sign-in?error=google_start_failed`, request.url));
  }

  const payload = (await response.json()) as { url?: string };

  if (!payload.url) {
    return NextResponse.redirect(new URL(`/${params.get("locale")}/sign-in?error=google_start_failed`, request.url));
  }

  return NextResponse.redirect(payload.url);
}
