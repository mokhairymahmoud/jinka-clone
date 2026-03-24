export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

export function getExpiredAuthCookieOptions() {
  return {
    ...authCookieOptions,
    expires: new Date(0)
  };
}

export function isJwtExpired(token: string, now = Date.now()) {
  const [, payload] = token.split(".");

  if (!payload) {
    return true;
  }

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };

    return typeof decoded.exp !== "number" || decoded.exp * 1000 <= now + 5_000;
  } catch {
    return true;
  }
}

export function getSetCookieHeaders(response: Response) {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const header = response.headers.get("set-cookie");
  return header ? [header] : [];
}

export function getCookieValueFromSetCookieHeaders(setCookieHeaders: string[], name: string) {
  const prefix = `${name}=`;

  for (const header of setCookieHeaders) {
    const segment = header
      .split(/,(?=[^;]+=[^;]+)/)
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));

    if (segment) {
      return segment.slice(prefix.length).split(";", 1)[0] ?? null;
    }
  }

  return null;
}

export function appendSetCookieHeaders(target: Headers, response: Response) {
  for (const header of getSetCookieHeaders(response)) {
    target.append("set-cookie", header);
  }
}
