import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { NotificationsService } from "./notifications.service.js";

class NotificationsQueryDto {
  @IsOptional()
  @IsString()
  alertId?: string;
}

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationsQueryDto) {
    return this.notificationsService.getNotifications(user.id, {
      alertId: query.alertId
    });
  }
}
