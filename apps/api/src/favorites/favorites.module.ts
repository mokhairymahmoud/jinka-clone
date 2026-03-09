import { Module } from "@nestjs/common";

import { FavoritesController } from "./favorites.controller.js";
import { FavoritesService } from "./favorites.service.js";
import { ListingsModule } from "../listings/listings.module.js";

@Module({
  imports: [ListingsModule],
  controllers: [FavoritesController],
  providers: [FavoritesService]
})
export class FavoritesModule {}
