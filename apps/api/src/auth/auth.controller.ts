import { Body, Controller, Get, Headers, Inject, Post, Query, Req, Res } from "@nestjs/common";
import { IsEmail, IsString, Length } from "class-validator";
import type { Request, Response } from "express";

import { AuthService } from "./auth.service.js";

class RequestOtpDto {
  @IsEmail()
  email!: string;
}

class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

class GoogleStartQueryDto {
  @IsString()
  locale!: string;

  @IsString()
  returnTo!: string;
}

class GoogleCallbackQueryDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("email/request-otp")
  requestOtp(@Body() body: RequestOtpDto) {
    return this.authService.requestOtp(body.email);
  }

  @Post("email/verify-otp")
  async verifyOtp(
    @Body() body: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.verifyOtp(body.email, body.code, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.cookie("access_token", result.accessToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.cookie("refresh_token", result.refreshToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    return result;
  }

  @Post("refresh")
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.refreshSession(body.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.cookie("access_token", result.accessToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.cookie("refresh_token", result.refreshToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    return result;
  }

  @Post("logout")
  async logout(
    @Headers("x-refresh-token") refreshTokenHeader: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    await this.authService.logout(refreshTokenHeader ?? req.cookies?.refresh_token);
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    return { success: true };
  }

  @Get("google/start")
  googleStart(@Query() query: GoogleStartQueryDto) {
    return this.authService.getGoogleStartUrl(query.locale, query.returnTo);
  }

  @Get("google/callback")
  async googleCallback(@Query() query: GoogleCallbackQueryDto, @Res() res: Response) {
    const result = await this.authService.getGoogleCallback(query.code, query.state);
    res.cookie("access_token", result.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    return res.redirect(result.returnTo);
  }
}
