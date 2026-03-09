import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PushSubscriptionsService } from "./push-subscriptions.service.js";

class CreatePushSubscriptionDto {
  @IsString()
  endpoint!: string;

  @IsString()
  p256dhKey!: string;

  @IsString()
  authKey!: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

@Controller("push-subscriptions")
@UseGuards(JwtAuthGuard)
export class PushSubscriptionsController {
  constructor(@Inject(PushSubscriptionsService) private readonly pushSubscriptionsService: PushSubscriptionsService) {}

  @Post()
  createPushSubscription(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePushSubscriptionDto) {
    return this.pushSubscriptionsService.createSubscription(user.id, body);
  }
}
