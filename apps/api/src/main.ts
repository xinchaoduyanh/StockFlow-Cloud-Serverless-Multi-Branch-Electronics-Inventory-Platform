import { otelSDK } from "./tracing";
otelSDK.start();

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";
import { EnvService } from "./config/env.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const port = app.get(EnvService).get("PORT");
  await app.listen(port);
}

void bootstrap();
