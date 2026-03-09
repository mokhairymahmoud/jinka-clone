import { Body, Controller, Post } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { AppStoreService } from "../common/app-store.service.js";

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
export class ReportsController {
  constructor(private readonly store: AppStoreService) {}

  @Post()
  createReport(@Body() body: CreateReportDto) {
    return this.store.createReport(body.clusterId, body.reason, body.details);
  }
}
