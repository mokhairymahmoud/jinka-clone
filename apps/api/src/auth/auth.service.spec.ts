import { describe, expect, it, vi } from "vitest";

import { HttpException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service.js";

describe("AuthService session management", () => {
  it("lists active sessions and marks the current session", async () => {
    const prisma = {
      authSession: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "session-current",
            userId: "user-1",
            userAgent: "Mozilla/5.0 (Mac OS X) Chrome/122.0",
            ipAddress: "127.0.0.1",
            createdAt: new Date("2026-03-24T10:00:00.000Z"),
            lastSeenAt: new Date("2026-03-24T12:00:00.000Z"),
            expiresAt: new Date("2026-03-31T12:00:00.000Z")
          },
          {
            id: "session-other",
            userId: "user-1",
            userAgent: "Mozilla/5.0 (Windows NT 10.0) Firefox/124.0",
            ipAddress: "10.0.0.2",
            createdAt: new Date("2026-03-20T10:00:00.000Z"),
            lastSeenAt: new Date("2026-03-23T09:00:00.000Z"),
            expiresAt: new Date("2026-03-30T12:00:00.000Z")
          }
        ])
      }
    };

    const service = new AuthService({} as never, prisma as never);

    await expect(service.getSessions("user-1", "session-current")).resolves.toEqual([
      {
        id: "session-current",
        current: true,
        deviceLabel: "Mac",
        browserLabel: "Chrome",
        ipAddress: "127.0.0.1",
        createdAt: "2026-03-24T10:00:00.000Z",
        lastSeenAt: "2026-03-24T12:00:00.000Z",
        expiresAt: "2026-03-31T12:00:00.000Z"
      },
      {
        id: "session-other",
        current: false,
        deviceLabel: "Windows PC",
        browserLabel: "Firefox",
        ipAddress: "10.0.0.2",
        createdAt: "2026-03-20T10:00:00.000Z",
        lastSeenAt: "2026-03-23T09:00:00.000Z",
        expiresAt: "2026-03-30T12:00:00.000Z"
      }
    ]);
  });

  it("revokes all other active sessions", async () => {
    const prisma = {
      authSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 })
      }
    };

    const service = new AuthService({} as never, prisma as never);

    await expect(service.revokeOtherSessions("user-1", "session-current")).resolves.toEqual({
      revokedCount: 2
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null,
        id: {
          not: "session-current"
        }
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
  });

  it("invalidates older OTP challenges when issuing a new one", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null)
      },
      otpChallenge: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: "challenge-2" })
      }
    };

    const service = new AuthService({} as never, prisma as never);

    await service.requestOtp("user@example.com", {
      ipAddress: "127.0.0.1"
    });

    expect(prisma.otpChallenge.updateMany).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        consumedAt: null,
        blockedAt: null,
        expiresAt: {
          gt: expect.any(Date)
        }
      },
      data: {
        consumedAt: expect.any(Date)
      }
    });
    expect(prisma.otpChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "user@example.com",
        requestIp: "127.0.0.1"
      })
    });
  });

  it("locks a challenge after repeated failed OTP attempts", async () => {
    const prisma = {
      otpChallenge: {
        findFirst: vi.fn().mockResolvedValue({
          id: "challenge-1",
          email: "user@example.com",
          codeHash: "expected-hash",
          attempts: 4,
          blockedAt: null
        }),
        update: vi.fn().mockResolvedValue({ id: "challenge-1" })
      }
    };
    const service = new AuthService({} as never, prisma as never);
    const hashSpy = vi.spyOn(service as never, "hashValue").mockReturnValue("wrong-hash");

    await expect(
      service.verifyOtp("user@example.com", "123456", {
        ipAddress: "127.0.0.1"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.otpChallenge.update).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
      data: expect.objectContaining({
        lastAttemptIp: "127.0.0.1",
        lastAttemptAt: expect.any(Date),
        blockedAt: expect.any(Date),
        attempts: {
          increment: 1
        }
      })
    });

    hashSpy.mockRestore();
  });

  it("throttles repeated OTP requests per email", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null)
      },
      otpChallenge: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "challenge-1" })
      }
    };
    const service = new AuthService({} as never, prisma as never);

    for (let index = 0; index < 5; index += 1) {
      await service.requestOtp("user@example.com", {
        ipAddress: "127.0.0.1"
      });
    }

    await expect(
      service.requestOtp("user@example.com", {
        ipAddress: "127.0.0.1"
      })
    ).rejects.toBeInstanceOf(HttpException);
  });
});
