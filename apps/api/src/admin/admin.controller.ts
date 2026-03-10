import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsOptional, IsString } from "class-validator";

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

class ResolveReportDto {
  @IsString()
  resolutionNote!: string;
}

class ToggleConnectorDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class CreateBlacklistDto {
  @IsString()
  source!: string;

  @IsString()
  matchType!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class ResolveParserDriftAlarmDto {
  @IsOptional()
  @IsString()
  note?: string;
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

  @Post("connectors/:source/disable")
  disableConnector(@CurrentUser() user: AuthenticatedUser, @Param("source") source: string, @Body() body: ToggleConnectorDto) {
    return this.adminService.disableConnector(user.id, source, body.reason);
  }

  @Post("connectors/:source/enable")
  enableConnector(@CurrentUser() user: AuthenticatedUser, @Param("source") source: string) {
    return this.adminService.enableConnector(user.id, source);
  }

  @Get("ingestion-runs")
  getIngestionRuns() {
    return this.adminService.getIngestionRuns();
  }

  @Get("fraud-cases")
  getFraudCases() {
    return this.adminService.getFraudCases();
  }

  @Get("cluster-edges")
  getClusterEdges() {
    return this.adminService.getClusterEdges();
  }

  @Get("reports")
  getReports() {
    return this.adminService.getReports();
  }

  @Get("blacklists")
  getBlacklists() {
    return this.adminService.getBlacklists();
  }

  @Get("parser-drift-alarms")
  getParserDriftAlarms() {
    return this.adminService.getParserDriftAlarms();
  }

  @Post("blacklists")
  createBlacklist(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBlacklistDto) {
    return this.adminService.createBlacklist(user.id, body);
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

  @Post("reports/:id/resolve")
  resolveReport(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: ResolveReportDto) {
    return this.adminService.resolveReport(user.id, id, body.resolutionNote);
  }

  @Post("parser-drift-alarms/:id/resolve")
  resolveParserDriftAlarm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() _body: ResolveParserDriftAlarmDto
  ) {
    return this.adminService.resolveParserDriftAlarm(user.id, id);
  }
}
