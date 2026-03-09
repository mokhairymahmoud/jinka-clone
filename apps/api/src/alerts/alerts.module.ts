import { Module } from "@nestjs/common";

import { AlertsController } from "./alerts.controller.js";
import { AlertsService } from "./alerts.service.js";
import { ListingsModule } from "../listings/listings.module.js";

@Module({
  imports: [ListingsModule],
  controllers: [AlertsController],
  providers: [AlertsService]
})
export class AlertsModule {}
