import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsString } from "class-validator";

import type { FraudAssessment } from "@jinka-eg/types";
import { AdminService } from "./admin.service.js";
import { AppStoreService } from "../common/app-store.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";

class MergeClusterDto {
  @IsString()
  targetClusterId!: string;
}

class SplitClusterDto {
  @IsArray()
  variantIds!: string[];
}

class ResolveFraudCaseDto {
  @IsString()
  label!: FraudAssessment["label"];
}

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "ops_reviewer")
export class AdminController {
  constructor(
    @Inject(AppStoreService) private readonly store: AppStoreService,
    @Inject(AdminService) private readonly adminService: AdminService
  ) {}

  @Get("connectors")
  getConnectors() {
    return this.adminService.getConnectorHealth();
  }

  @Get("ingestion-runs")
  getIngestionRuns() {
    return this.adminService.getIngestionRuns();
  }

  @Get("fraud-cases")
  getFraudCases() {
    return this.adminService.getFraudCases();
  }

  @Post("clusters/:id/merge")
  mergeCluster(@Param("id") id: string, @Body() body: MergeClusterDto) {
    return this.store.mergeCluster(id, body.targetClusterId);
  }

  @Post("clusters/:id/split")
  splitCluster(@Param("id") id: string, @Body() body: SplitClusterDto) {
    return this.store.splitCluster(id, body.variantIds);
  }

  @Post("fraud-cases/:id/resolve")
  resolveFraudCase(@Param("id") id: string, @Body() body: ResolveFraudCaseDto) {
    return this.store.resolveFraudCase(id, body.label);
  }
}
