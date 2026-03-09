import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import { IsEmail, IsString } from "class-validator";
import type { Response } from "express";

import { AuthService } from "./auth.service.js";

class RequestOtpDto {
  @IsEmail()
  email!: string;
}

class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  code!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("email/request-otp")
  requestOtp(@Body() body: RequestOtpDto) {
    return this.authService.requestOtp(body.email);
  }

  @Post("email/verify-otp")
  verifyOtp(@Body() body: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = this.authService.verifyOtp(body.email);
    res.cookie("access_token", result.accessToken, { httpOnly: true, sameSite: "lax" });
    res.cookie("refresh_token", result.refreshToken, { httpOnly: true, sameSite: "lax" });
    return result;
  }

  @Get("google/start")
  googleStart() {
    return this.authService.getGoogleStartUrl();
  }

  @Get("google/callback")
  googleCallback(@Res({ passthrough: true }) res: Response) {
    const result = this.authService.getGoogleCallback();
    res.cookie("access_token", result.accessToken, { httpOnly: true, sameSite: "lax" });
    res.cookie("refresh_token", result.refreshToken, { httpOnly: true, sameSite: "lax" });
    return result;
  }
}
