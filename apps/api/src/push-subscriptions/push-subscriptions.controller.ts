import { Body, Controller, Delete, Get, Inject, Post, UseGuards } from "@nestjs/common";
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

class DeletePushSubscriptionDto {
  @IsString()
  endpoint!: string;
}

@Controller("push-subscriptions")
export class PushSubscriptionsController {
  constructor(@Inject(PushSubscriptionsService) private readonly pushSubscriptionsService: PushSubscriptionsService) {}

  @Get("public-key")
  getPublicKey() {
    return this.pushSubscriptionsService.getPublicKey();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createPushSubscription(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePushSubscriptionDto) {
    return this.pushSubscriptionsService.createSubscription(user.id, body);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  deletePushSubscription(@CurrentUser() user: AuthenticatedUser, @Body() body: DeletePushSubscriptionDto) {
    return this.pushSubscriptionsService.deleteSubscription(user.id, body.endpoint);
  }
}
