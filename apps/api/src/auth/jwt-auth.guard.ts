import { CanActivate, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import type { AuthenticatedUser } from "./auth.types.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async canActivate(context: import("@nestjs/common").ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const rawHeader = request.headers.authorization;
    const bearerToken = rawHeader?.startsWith("Bearer ") ? rawHeader.slice(7) : undefined;
    const token = bearerToken ?? request.cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: AuthenticatedUser["role"];
      }>(token, { secret: process.env.JWT_ACCESS_SECRET ?? "development-secret" });

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role
      } satisfies AuthenticatedUser;

      return true;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }
}
