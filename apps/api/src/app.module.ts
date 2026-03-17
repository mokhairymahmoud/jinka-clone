import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { AdminModule } from "./admin/admin.module.js";
import { AlertsModule } from "./alerts/alerts.module.js";
import { AreasModule } from "./areas/areas.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { sharedEnvSchema } from "@jinka-eg/config";
import { CommonModule } from "./common/common.module.js";
import { FavoritesModule } from "./favorites/favorites.module.js";
import { ListingsModule } from "./listings/listings.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { PushSubscriptionsModule } from "./push-subscriptions/push-subscriptions.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { ShortlistsModule } from "./shortlists/shortlists.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => sharedEnvSchema.partial().parse(env)
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? "development-secret",
      signOptions: { expiresIn: "15m" }
    }),
    CommonModule,
    AuthModule,
    UsersModule,
    AreasModule,
    ListingsModule,
    ProjectsModule,
    AlertsModule,
    FavoritesModule,
    ShortlistsModule,
    NotificationsModule,
    PushSubscriptionsModule,
    ReportsModule,
    AdminModule
  ]
})
export class AppModule {}
