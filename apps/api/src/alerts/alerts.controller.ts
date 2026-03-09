import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

import type { SearchFilters } from "@jinka-eg/types";
import { AppStoreService } from "../common/app-store.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

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
  constructor(@Inject(AppStoreService) private readonly store: AppStoreService) {}

  @Get()
  getAlerts() {
    return this.store.getAlerts();
  }

  @Post()
  createAlert(@Body() body: CreateAlertDto) {
    return this.store.createAlert(body);
  }

  @Patch(":id")
  updateAlert(@Param("id") id: string, @Body() body: UpdateAlertDto) {
    return this.store.updateAlert(id, body);
  }

  @Post(":id/test")
  testAlert(@Param("id") id: string) {
    return {
      id,
      matchedListingIds: this.store.getListings().slice(0, 1).map((listing) => listing.id)
    };
  }
}
