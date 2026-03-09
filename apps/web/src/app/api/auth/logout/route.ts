import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiFetch } from "../../../../lib/api";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (refreshToken) {
    await apiFetch("/v1/auth/logout", {
      method: "POST",
      headers: {
        "x-refresh-token": refreshToken
      }
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("access_token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/"
  });
  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/"
  });

  return response;
}
