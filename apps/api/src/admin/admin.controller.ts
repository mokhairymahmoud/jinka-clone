import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsString } from "class-validator";

import type { FraudAssessment } from "@jinka-eg/types";
import { AdminService } from "./admin.service.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

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
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

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
  mergeCluster(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: MergeClusterDto) {
    return this.adminService.mergeCluster(user.id, id, body.targetClusterId);
  }

  @Post("clusters/:id/split")
  splitCluster(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: SplitClusterDto) {
    return this.adminService.splitCluster(user.id, id, body.variantIds);
  }

  @Post("fraud-cases/:id/resolve")
  resolveFraudCase(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: ResolveFraudCaseDto) {
    return this.adminService.resolveFraudCase(user.id, id, body.label);
  }
}
