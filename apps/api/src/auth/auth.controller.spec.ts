import { describe, expect, it, vi } from "vitest";

import { AuthController } from "./auth.controller.js";

describe("AuthController session responses", () => {
  const user = {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    locale: "en",
    role: "user" as const,
    notificationPrefs: {
      emailEnabled: true,
      pushEnabled: true
    }
  };

  it("does not expose raw tokens in verifyOtp responses", async () => {
    const authService = {
      verifyOtp: vi.fn().mockResolvedValue({
        user,
        accessToken: "access-token",
        refreshToken: "refresh-token"
      })
    };
    const controller = new AuthController(authService as never);
    const response = {
      cookie: vi.fn()
    };

    await expect(
      controller.verifyOtp(
        { email: "user@example.com", code: "123456" },
        { ip: "127.0.0.1", headers: { "user-agent": "vitest" } } as never,
        response as never
      )
    ).resolves.toEqual({ user });
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });

  it("does not expose raw tokens in refresh responses", async () => {
    const authService = {
      refreshSession: vi.fn().mockResolvedValue({
        user,
        accessToken: "access-token",
        refreshToken: "refresh-token"
      })
    };
    const controller = new AuthController(authService as never);
    const response = {
      cookie: vi.fn()
    };

    await expect(
      controller.refresh(
        { refreshToken: "refresh-token" },
        { ip: "127.0.0.1", headers: { "user-agent": "vitest" } } as never,
        response as never
      )
    ).resolves.toEqual({ user });
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });
});
