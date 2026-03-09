import { Module } from "@nestjs/common";

import { FavoritesController } from "./favorites.controller.js";

@Module({
  controllers: [FavoritesController]
})
export class FavoritesModule {}
