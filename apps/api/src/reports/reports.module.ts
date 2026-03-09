import { Module } from "@nestjs/common";

import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";
import { ListingsModule } from "../listings/listings.module.js";

@Module({
  imports: [ListingsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService]
})
export class ReportsModule {}
