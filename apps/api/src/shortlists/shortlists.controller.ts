import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { IsEmail, IsString } from "class-validator";

import { AppStoreService } from "../common/app-store.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

class CreateShortlistDto {
  @IsString()
  name!: string;
}

class ShareShortlistDto {
  @IsEmail()
  email!: string;
}

@Controller("shortlists")
@UseGuards(JwtAuthGuard)
export class ShortlistsController {
  constructor(@Inject(AppStoreService) private readonly store: AppStoreService) {}

  @Post()
  createShortlist(@Body() body: CreateShortlistDto) {
    return this.store.createShortlist(body.name);
  }

  @Post(":id/share")
  shareShortlist(@Param("id") id: string, @Body() body: ShareShortlistDto) {
    return this.store.shareShortlist(id, body.email);
  }

  @Get(":id")
  getShortlist(@Param("id") id: string) {
    return this.store.getShortlist(id);
  }
}
