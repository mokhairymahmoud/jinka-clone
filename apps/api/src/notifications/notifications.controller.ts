import { Controller, Get } from "@nestjs/common";

import { AppStoreService } from "../common/app-store.service.js";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly store: AppStoreService) {}

  @Get()
  getNotifications() {
    return this.store.getNotifications();
  }
}
