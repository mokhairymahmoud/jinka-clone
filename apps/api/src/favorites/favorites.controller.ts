import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { FavoritesService } from "./favorites.service.js";

class CreateFavoriteDto {
  @IsString()
  clusterId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class UpdateFavoriteDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  state?: "saved" | "shortlisted";
}

@Controller("favorites")
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(@Inject(FavoritesService) private readonly favoritesService: FavoritesService) {}

  @Get()
  getFavorites(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.getFavorites(user.id);
  }

  @Post()
  createFavorite(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFavoriteDto) {
    return this.favoritesService.createFavorite(user.id, body.clusterId, body.note);
  }

  @Patch(":id")
  updateFavorite(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: UpdateFavoriteDto) {
    return this.favoritesService.updateFavorite(user.id, id, body);
  }
}
