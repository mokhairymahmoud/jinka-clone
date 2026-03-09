import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { AppStoreService } from "../common/app-store.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

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
  constructor(@Inject(AppStoreService) private readonly store: AppStoreService) {}

  @Get()
  getFavorites() {
    return this.store.getFavorites();
  }

  @Post()
  createFavorite(@Body() body: CreateFavoriteDto) {
    return this.store.addFavorite(body.clusterId, body.note);
  }

  @Patch(":id")
  updateFavorite(@Param("id") id: string, @Body() body: UpdateFavoriteDto) {
    return this.store.updateFavorite(id, body);
  }
}
