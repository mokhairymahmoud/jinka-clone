import { Module } from "@nestjs/common";

import { AlertsController } from "./alerts.controller.js";

@Module({
  controllers: [AlertsController]
})
export class AlertsModule {}
