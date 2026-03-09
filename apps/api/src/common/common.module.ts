import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { AppStoreService } from "./app-store.service.js";
import { AllExceptionsFilter } from "./all-exceptions.filter.js";
import { PrismaService } from "./prisma.service.js";
import { RequestLoggingInterceptor } from "./request-logging.interceptor.js";

@Global()
@Module({
  providers: [
    AppStoreService,
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter
    }
  ],
  exports: [AppStoreService, PrismaService]
})
export class CommonModule {}
