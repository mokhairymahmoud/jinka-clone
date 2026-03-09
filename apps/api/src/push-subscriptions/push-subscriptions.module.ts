import { Module } from "@nestjs/common";

import { PushSubscriptionsController } from "./push-subscriptions.controller.js";
import { PushSubscriptionsService } from "./push-subscriptions.service.js";

@Module({
  controllers: [PushSubscriptionsController],
  providers: [PushSubscriptionsService]
})
export class PushSubscriptionsModule {}
