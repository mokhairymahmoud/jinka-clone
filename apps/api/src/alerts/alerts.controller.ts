import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

import type { AlertDeliveryCadence, SearchFilters } from "@jinka-eg/types";
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

  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;

  @IsOptional()
  @IsDateString()
  snoozedUntil?: string;

  @IsOptional()
  @IsIn(["immediate", "daily", "weekly"])
  deliveryCadence?: AlertDeliveryCadence;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPriceDropPercent?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPriceDropAmount?: number | null;
}

class UpdateAlertDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  filters?: SearchFilters;

  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyByPush?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @IsOptional()
  @IsDateString()
  snoozedUntil?: string;

  @IsOptional()
  @IsBoolean()
  clearSnooze?: boolean;

  @IsOptional()
  @IsIn(["immediate", "daily", "weekly"])
  deliveryCadence?: AlertDeliveryCadence;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPriceDropPercent?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPriceDropAmount?: number | null;
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

  @Delete(":id")
  deleteAlert(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.deleteAlert(user.id, id);
  }

  @Post(":id/test")
  testAlert(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.testAlert(user.id, id);
  }
}
