import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { ReportsService } from "./reports.service.js";

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
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get()
  getOwnReports(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getOwnReports(user.id);
  }

  @Post()
  createReport(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateReportDto) {
    return this.reportsService.createReport(user.id, body.clusterId, body.reason, body.details);
  }
}
