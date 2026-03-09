import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { UsersService } from "./users.service.js";

class UpdateMeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(["en", "ar"])
  locale?: string;

  @IsOptional()
  @IsObject()
  notificationPrefs?: {
    emailEnabled?: boolean;
    pushEnabled?: boolean;
  };
}

@Controller()
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMeDto) {
    return this.usersService.updateProfile(user.id, body);
  }
}
