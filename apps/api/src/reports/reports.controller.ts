import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { AppStoreService } from "../common/app-store.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

class CreateReportDto {
  @IsString()
  clusterId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  details?: string;
}

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(@Inject(AppStoreService) private readonly store: AppStoreService) {}

  @Post()
  createReport(@Body() body: CreateReportDto) {
    return this.store.createReport(body.clusterId, body.reason, body.details);
  }
}
