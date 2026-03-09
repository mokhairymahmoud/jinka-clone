import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

import type { SearchFilters } from "@jinka-eg/types";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { AlertsService } from "./alerts.service.js";

class CreateAlertDto {
  @IsString()
  name!: string;

  @IsString()
  locale!: "en" | "ar";

  @IsObject()
  filters!: SearchFilters;

  @IsBoolean()
  notifyByPush!: boolean;

  @IsBoolean()
  notifyByEmail!: boolean;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;
}

class UpdateAlertDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  filters?: SearchFilters;
}

@Controller("alerts")
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(@Inject(AlertsService) private readonly alertsService: AlertsService) {}

  @Get()
  getAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.alertsService.getAlerts(user.id);
  }

  @Post()
  createAlert(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAlertDto) {
    return this.alertsService.createAlert(user.id, body);
  }

  @Patch(":id")
  updateAlert(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: UpdateAlertDto) {
    return this.alertsService.updateAlert(user.id, id, body);
  }

  @Post(":id/test")
  testAlert(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.testAlert(user.id, id);
  }
}
