import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsArray, IsString } from "class-validator";

import type { FraudAssessment } from "@jinka-eg/types";
import { AppStoreService } from "../common/app-store.service.js";

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
export class AdminController {
  constructor(private readonly store: AppStoreService) {}

  @Get("connectors")
  getConnectors() {
    return this.store.getConnectorHealth();
  }

  @Get("ingestion-runs")
  getIngestionRuns() {
    return this.store.getIngestionRuns();
  }

  @Get("fraud-cases")
  getFraudCases() {
    return this.store.getFraudCases();
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
