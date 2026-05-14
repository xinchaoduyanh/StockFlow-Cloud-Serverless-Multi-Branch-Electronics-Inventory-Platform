import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const { EnvService } = await import("./config/env.service");
  const port = app.get(EnvService).get("PORT");
  await app.listen(port);
}

void bootstrap();
