import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { AppStoreService } from "../common/app-store.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(@Inject(AppStoreService) private readonly store: AppStoreService) {}

  @Get()
  getNotifications() {
    return this.store.getNotifications();
  }
}
