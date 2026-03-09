import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsEmail, IsOptional, IsString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { ShortlistsService } from "./shortlists.service.js";

class CreateShortlistDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  clusterIds?: string[];
}

class ShareShortlistDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  role?: string;
}

class AddShortlistItemDto {
  @IsString()
  clusterId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class AddShortlistCommentDto {
  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  clusterId?: string;
}

@Controller("shortlists")
@UseGuards(JwtAuthGuard)
export class ShortlistsController {
  constructor(@Inject(ShortlistsService) private readonly shortlistsService: ShortlistsService) {}

  @Get()
  getShortlists(@CurrentUser() user: AuthenticatedUser) {
    return this.shortlistsService.getShortlistsForUser(user.id);
  }

  @Post()
  createShortlist(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateShortlistDto) {
    return this.shortlistsService.createShortlist(user.id, body);
  }

  @Post(":id/share")
  shareShortlist(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: ShareShortlistDto) {
    return this.shortlistsService.shareShortlist(user.id, id, body.email, body.role);
  }

  @Post(":id/items")
  addItem(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AddShortlistItemDto) {
    return this.shortlistsService.createShortlistItem(user.id, id, body.clusterId, body.note);
  }

  @Post(":id/comments")
  addComment(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: AddShortlistCommentDto) {
    return this.shortlistsService.addComment(user.id, id, body.body, body.clusterId);
  }

  @Get(":id")
  getShortlist(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.shortlistsService.getShortlist(user.id, id);
  }
}
