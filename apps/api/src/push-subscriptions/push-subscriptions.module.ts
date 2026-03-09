import { Module } from "@nestjs/common";

import { PushSubscriptionsController } from "./push-subscriptions.controller.js";

@Module({
  controllers: [PushSubscriptionsController]
})
export class PushSubscriptionsModule {}
