import { Module } from "@nestjs/common";

import { ShortlistsController } from "./shortlists.controller.js";
import { ShortlistsService } from "./shortlists.service.js";
import { ListingsModule } from "../listings/listings.module.js";

@Module({
  imports: [ListingsModule],
  controllers: [ShortlistsController],
  providers: [ShortlistsService]
})
export class ShortlistsModule {}
