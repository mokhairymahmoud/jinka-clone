import { describe, expect, it } from "vitest";

import { getCookieValueFromSetCookieHeaders, isJwtExpired } from "./auth";

function createUnsignedJwt(exp: number) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `header.${payload}.signature`;
}

describe("auth helpers", () => {
  it("treats future-expiring JWTs as valid", () => {
    const token = createUnsignedJwt(Math.floor(Date.now() / 1000) + 60);

    expect(isJwtExpired(token)).toBe(false);
  });

  it("treats expired JWTs as invalid", () => {
    const token = createUnsignedJwt(Math.floor(Date.now() / 1000) - 60);

    expect(isJwtExpired(token)).toBe(true);
  });

  it("extracts cookie values from set-cookie headers", () => {
    const value = getCookieValueFromSetCookieHeaders(
      [
        "access_token=access-value; Path=/; HttpOnly",
        "refresh_token=refresh-value; Path=/; HttpOnly"
      ],
      "refresh_token"
    );

    expect(value).toBe("refresh-value");
  });
});
