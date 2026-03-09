import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { AppStoreService } from "../common/app-store.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

class CreatePushSubscriptionDto {
  @IsString()
  endpoint!: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

@Controller("push-subscriptions")
@UseGuards(JwtAuthGuard)
export class PushSubscriptionsController {
  constructor(@Inject(AppStoreService) private readonly store: AppStoreService) {}

  @Post()
  createPushSubscription(@Body() body: CreatePushSubscriptionDto) {
    return this.store.createPushSubscription(body.endpoint, body.platform);
  }
}
