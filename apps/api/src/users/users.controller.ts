import { Controller, Get } from "@nestjs/common";

import { AppStoreService } from "../common/app-store.service.js";

@Controller()
export class UsersController {
  constructor(private readonly store: AppStoreService) {}

  @Get("me")
  getMe() {
    return this.store.getCurrentUser();
  }
}
