import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { AppStoreService } from "../common/app-store.service.js";

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
export class FavoritesController {
  constructor(private readonly store: AppStoreService) {}

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
