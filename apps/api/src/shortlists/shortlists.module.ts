import { Module } from "@nestjs/common";

import { ShortlistsController } from "./shortlists.controller.js";

@Module({
  controllers: [ShortlistsController]
})
export class ShortlistsModule {}
