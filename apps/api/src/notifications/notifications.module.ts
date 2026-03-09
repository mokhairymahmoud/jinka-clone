import { Module } from "@nestjs/common";

import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { ListingsModule } from "../listings/listings.module.js";

@Module({
  imports: [ListingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService]
})
export class NotificationsModule {}
