import "reflect-metadata";

import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { bootstrapObservability, shutdownObservability } from "./common/observability.js";

async function bootstrap() {
  await bootstrapObservability();
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"],
      credentials: true
    }
  });

  app.setGlobalPrefix("v1");
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );

  const port = Number(process.env.PORT ?? 4000);
  app.enableShutdownHooks();
  process.on("SIGTERM", () => {
    void shutdownObservability();
  });
  process.on("SIGINT", () => {
    void shutdownObservability();
  });
  await app.listen(port);
}

void bootstrap();
