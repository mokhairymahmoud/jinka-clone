import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { AppStoreService } from "../common/app-store.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly store: AppStoreService
  ) {}

  requestOtp(email: string) {
    return {
      success: true,
      email,
      otpPreview: "123456"
    };
  }

  verifyOtp(email: string) {
    const user = this.store.getCurrentUser();
    const payload = { sub: user.id, email, role: user.role };
    return {
      user,
      accessToken: this.jwtService.sign(payload, { expiresIn: "15m" }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: "7d", secret: process.env.JWT_REFRESH_SECRET ?? "refresh-secret" })
    };
  }

  getGoogleStartUrl() {
    return {
      url: "/v1/auth/google/callback?code=demo-code"
    };
  }

  getGoogleCallback() {
    return this.verifyOtp(this.store.getCurrentUser().email);
  }
}
