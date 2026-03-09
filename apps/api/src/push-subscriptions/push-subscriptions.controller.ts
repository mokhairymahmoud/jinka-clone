import { Body, Controller, Post } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { AppStoreService } from "../common/app-store.service.js";

class CreatePushSubscriptionDto {
  @IsString()
  endpoint!: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

@Controller("push-subscriptions")
export class PushSubscriptionsController {
  constructor(private readonly store: AppStoreService) {}

  @Post()
  createPushSubscription(@Body() body: CreatePushSubscriptionDto) {
    return this.store.createPushSubscription(body.endpoint, body.platform);
  }
}
