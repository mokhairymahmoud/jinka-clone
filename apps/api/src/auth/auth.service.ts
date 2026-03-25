import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { createHash, randomInt } from "node:crypto";
import Redis from "ioredis";

import type { AuthSessionRecord } from "@jinka-eg/types";
import { PrismaService } from "../common/prisma.service.js";

const OTP_REQUEST_WINDOW_SECONDS = 15 * 60;
const OTP_VERIFY_WINDOW_SECONDS = 15 * 60;
const OTP_MAX_REQUESTS_PER_EMAIL = 5;
const OTP_MAX_REQUESTS_PER_IP = 12;
const OTP_MAX_VERIFY_ATTEMPTS_PER_EMAIL = 10;
const OTP_MAX_VERIFY_ATTEMPTS_PER_IP = 20;
const OTP_MAX_CHALLENGE_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private redisClient: Redis | null | undefined;
  private readonly inMemoryRateLimits = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  private hashValue(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private toPublicRole(role: UserRole) {
    if (role === UserRole.ADMIN) return "admin" as const;
    if (role === UserRole.OPS_REVIEWER) return "ops_reviewer" as const;
    return "user" as const;
  }

  private summarizeDevice(userAgent?: string | null) {
    const source = userAgent?.toLowerCase() ?? "";

    if (!source) {
      return {
        browserLabel: "Unknown browser",
        deviceLabel: "Unknown device"
      };
    }

    const browserLabel = source.includes("edg/")
      ? "Edge"
      : source.includes("chrome/")
        ? "Chrome"
        : source.includes("firefox/")
          ? "Firefox"
          : source.includes("safari/") && !source.includes("chrome/")
            ? "Safari"
            : "Browser";
    const deviceLabel = source.includes("iphone")
      ? "iPhone"
      : source.includes("ipad")
        ? "iPad"
        : source.includes("android")
          ? "Android device"
          : source.includes("mac os")
            ? "Mac"
            : source.includes("windows")
              ? "Windows PC"
              : source.includes("linux")
                ? "Linux device"
                : "Device";

    return { browserLabel, deviceLabel };
  }

  private getRedisClient() {
    if (this.redisClient !== undefined) {
      return this.redisClient;
    }

    if (!process.env.REDIS_URL) {
      this.redisClient = null;
      return this.redisClient;
    }

    this.redisClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });

    return this.redisClient;
  }

  private async incrementRateLimit(key: string, windowSeconds: number) {
    const redis = this.getRedisClient();

    if (redis) {
      try {
        if (redis.status === "wait") {
          await redis.connect();
        }

        const count = await redis.incr(key);

        if (count === 1) {
          await redis.expire(key, windowSeconds);
        }

        return count;
      } catch (error) {
        console.warn("Falling back to in-memory auth rate limiting", error);
      }
    }

    const now = Date.now();
    const existing = this.inMemoryRateLimits.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.inMemoryRateLimits.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000
      });
      return 1;
    }

    existing.count += 1;
    this.inMemoryRateLimits.set(key, existing);
    return existing.count;
  }

  private async assertOtpRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number,
    details: { action: "request" | "verify"; scope: "email" | "ip"; identifier: string }
  ) {
    const count = await this.incrementRateLimit(key, windowSeconds);

    if (count <= maxRequests) {
      return;
    }

    console.warn("OTP rate limit triggered", details);
    throw new HttpException("Too many OTP attempts. Please wait before trying again.", HttpStatus.TOO_MANY_REQUESTS);
  }

  private async createAuthPayload(user: { id: string; email: string; role: UserRole }, metadata?: { ipAddress?: string; userAgent?: string }) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: this.toPublicRole(user.role),
        sid: sessionId
      },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? "refresh-secret",
        expiresIn: "7d"
      }
    );

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashValue(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      }
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: this.toPublicRole(user.role),
        sid: sessionId
      },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? "development-secret",
        expiresIn: "15m"
      }
    );

    return {
      accessToken,
      refreshToken
    };
  }

  async requestOtp(email: string, metadata?: { ipAddress?: string }) {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    const code = String(randomInt(100000, 999999));
    const now = new Date();

    await this.assertOtpRateLimit(`otp:request:email:${normalizedEmail}`, OTP_MAX_REQUESTS_PER_EMAIL, OTP_REQUEST_WINDOW_SECONDS, {
      action: "request",
      scope: "email",
      identifier: normalizedEmail
    });

    if (metadata?.ipAddress) {
      await this.assertOtpRateLimit(`otp:request:ip:${metadata.ipAddress}`, OTP_MAX_REQUESTS_PER_IP, OTP_REQUEST_WINDOW_SECONDS, {
        action: "request",
        scope: "ip",
        identifier: metadata.ipAddress
      });
    }

    await this.prisma.otpChallenge.updateMany({
      where: {
        email: normalizedEmail,
        consumedAt: null,
        blockedAt: null,
        expiresAt: {
          gt: now
        }
      },
      data: {
        consumedAt: now
      }
    });

    await this.prisma.otpChallenge.create({
      data: {
        email: normalizedEmail,
        userId: existingUser?.id,
        codeHash: this.hashValue(code),
        requestIp: metadata?.ipAddress,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    return {
      success: true,
      email: normalizedEmail,
      expiresInSeconds: 600,
      otpPreview: process.env.NODE_ENV === "production" ? undefined : code
    };
  }

  async verifyOtp(email: string, code: string, metadata?: { ipAddress?: string; userAgent?: string }) {
    const normalizedEmail = email.trim().toLowerCase();

    await this.assertOtpRateLimit(`otp:verify:email:${normalizedEmail}`, OTP_MAX_VERIFY_ATTEMPTS_PER_EMAIL, OTP_VERIFY_WINDOW_SECONDS, {
      action: "verify",
      scope: "email",
      identifier: normalizedEmail
    });

    if (metadata?.ipAddress) {
      await this.assertOtpRateLimit(`otp:verify:ip:${metadata.ipAddress}`, OTP_MAX_VERIFY_ATTEMPTS_PER_IP, OTP_VERIFY_WINDOW_SECONDS, {
        action: "verify",
        scope: "ip",
        identifier: metadata.ipAddress
      });
    }

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        email: normalizedEmail,
        consumedAt: null,
        blockedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!challenge) {
      throw new UnauthorizedException("OTP challenge expired or not found");
    }

    if (challenge.attempts >= OTP_MAX_CHALLENGE_ATTEMPTS) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          blockedAt: challenge.blockedAt ?? new Date(),
          lastAttemptIp: metadata?.ipAddress,
          lastAttemptAt: new Date()
        }
      });
      console.warn("OTP challenge locked before verification", {
        email: normalizedEmail,
        ipAddress: metadata?.ipAddress
      });
      throw new UnauthorizedException("OTP challenge locked");
    }

    if (challenge.codeHash !== this.hashValue(code)) {
      const nextAttempts = challenge.attempts + 1;
      const blockedAt = nextAttempts >= OTP_MAX_CHALLENGE_ATTEMPTS ? new Date() : undefined;

      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          lastAttemptIp: metadata?.ipAddress,
          lastAttemptAt: new Date(),
          attempts: {
            increment: 1
          },
          ...(blockedAt ? { blockedAt } : {})
        }
      });

      if (blockedAt) {
        console.warn("OTP challenge locked after repeated failures", {
          email: normalizedEmail,
          ipAddress: metadata?.ipAddress
        });
        throw new UnauthorizedException("OTP challenge locked");
      }

      throw new UnauthorizedException("Invalid OTP code");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: new Date(),
          lastAttemptIp: metadata?.ipAddress,
          lastAttemptAt: new Date()
        }
      });

      return tx.user.upsert({
        where: { email: normalizedEmail },
        update: {},
        create: {
          email: normalizedEmail,
          locale: "en",
          notificationPrefs: {
            emailEnabled: true,
            pushEnabled: true
          },
          role: normalizedEmail === "demo@example.com" ? UserRole.ADMIN : UserRole.USER
        }
      });
    });

    const tokens = await this.createAuthPayload(user, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        role: this.toPublicRole(user.role),
        notificationPrefs: user.notificationPrefs ?? {
          emailEnabled: true,
          pushEnabled: true
        }
      },
      ...tokens
    };
  }

  private getGoogleRedirectUri() {
    return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/v1/auth/google/callback`;
  }

  private getGoogleStateSecret() {
    return process.env.GOOGLE_CLIENT_SECRET ?? process.env.JWT_REFRESH_SECRET ?? "refresh-secret";
  }

  private getAppBaseUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }

  private sanitizeReturnTo(returnTo: string | undefined, locale: string) {
    const fallback = new URL(`/${locale}/search/units`, this.getAppBaseUrl()).toString();

    if (!returnTo) {
      return fallback;
    }

    try {
      const appBaseUrl = new URL(this.getAppBaseUrl());
      const resolved = returnTo.startsWith("/")
        ? new URL(returnTo, appBaseUrl)
        : new URL(returnTo);

      return resolved.origin === appBaseUrl.origin ? resolved.toString() : fallback;
    } catch {
      return fallback;
    }
  }

  async getGoogleStartUrl(locale = "en", returnTo = "/en/search/units") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.NEXT_PUBLIC_API_URL) {
      throw new BadRequestException("Google OAuth is not configured");
    }

    const safeLocale = locale === "ar" ? "ar" : "en";
    const safeReturnTo = this.sanitizeReturnTo(returnTo, safeLocale);
    const state = await this.jwtService.signAsync(
      {
        locale: safeLocale,
        returnTo: safeReturnTo,
        scope: "google_oauth"
      },
      {
        secret: this.getGoogleStateSecret(),
        expiresIn: "10m"
      }
    );
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: this.getGoogleRedirectUri(),
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      state
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    };
  }

  async getGoogleCallback(code: string, state: string) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.NEXT_PUBLIC_API_URL) {
      throw new BadRequestException("Google OAuth is not configured");
    }

    const oauthState = await this.jwtService.verifyAsync<{
      locale?: string;
      returnTo?: string;
      scope?: string;
    }>(state, {
      secret: this.getGoogleStateSecret()
    });

    if (oauthState.scope !== "google_oauth") {
      throw new UnauthorizedException("Google OAuth state is invalid");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: this.getGoogleRedirectUri(),
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException("Unable to exchange Google OAuth code");
    }

    const tokenPayload = (await tokenResponse.json()) as { access_token?: string };

    if (!tokenPayload.access_token) {
      throw new UnauthorizedException("Google OAuth response did not include an access token");
    }

    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        authorization: `Bearer ${tokenPayload.access_token}`
      }
    });

    if (!userResponse.ok) {
      throw new UnauthorizedException("Unable to load Google profile");
    }

    const profile = (await userResponse.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };

    if (!profile.email || profile.email_verified === false) {
      throw new UnauthorizedException("Google account email is unavailable or unverified");
    }

    const safeLocale = oauthState.locale === "ar" ? "ar" : "en";
    const user = await this.prisma.user.upsert({
      where: {
        email: profile.email.trim().toLowerCase()
      },
      update: {
        name: profile.name ?? undefined,
        locale: safeLocale
      },
      create: {
        email: profile.email.trim().toLowerCase(),
        name: profile.name ?? undefined,
        locale: safeLocale,
        notificationPrefs: {
          emailEnabled: true,
          pushEnabled: true
        },
        role: UserRole.USER
      }
    });
    const tokens = await this.createAuthPayload(user);

    return {
      ...tokens,
      returnTo: this.sanitizeReturnTo(oauthState.returnTo, safeLocale)
    };
  }

  async refreshSession(refreshToken: string, metadata?: { ipAddress?: string; userAgent?: string }) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        sid: string;
      }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? "refresh-secret"
      });

      const existingSession = await this.prisma.authSession.findUnique({
        where: { id: payload.sid }
      });

      if (
        !existingSession ||
        existingSession.revokedAt ||
        existingSession.expiresAt < new Date() ||
        existingSession.refreshTokenHash !== this.hashValue(refreshToken)
      ) {
        throw new UnauthorizedException("Refresh session is invalid");
      }

      await this.prisma.authSession.update({
        where: { id: existingSession.id },
        data: {
          revokedAt: new Date()
        }
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub }
      });

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      const tokens = await this.createAuthPayload(user, metadata);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          locale: user.locale,
          role: this.toPublicRole(user.role),
          notificationPrefs: user.notificationPrefs ?? {
            emailEnabled: true,
            pushEnabled: true
          }
        },
        ...tokens
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Unable to refresh session");
    }
  }

  async getSessions(userId: string, currentSessionId?: string): Promise<AuthSessionRecord[]> {
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        lastSeenAt: "desc"
      }
    });

    return sessions.map((session) => {
      const summary = this.summarizeDevice(session.userAgent);

      return {
        id: session.id,
        current: session.id === currentSessionId,
        deviceLabel: summary.deviceLabel,
        browserLabel: summary.browserLabel,
        ipAddress: session.ipAddress ?? null,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        expiresAt: session.expiresAt.toISOString()
      };
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return {
      sessionId,
      revoked: result.count > 0
    };
  }

  async revokeOtherSessions(userId: string, currentSessionId?: string) {
    if (!currentSessionId) {
      throw new UnauthorizedException("Current session is unavailable");
    }

    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: { not: currentSessionId }
      },
      data: {
        revokedAt: new Date()
      }
    });

    return {
      revokedCount: result.count
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return { success: true };
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sid: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? "refresh-secret"
      });

      await this.prisma.authSession.updateMany({
        where: { id: payload.sid },
        data: { revokedAt: new Date() }
      });
    } catch {
      return { success: true };
    }

    return { success: true };
  }
}
