import { Global, Module } from "@nestjs/common";

import { AppStoreService } from "./app-store.service.js";

@Global()
@Module({
  providers: [AppStoreService],
  exports: [AppStoreService]
})
export class CommonModule {}
