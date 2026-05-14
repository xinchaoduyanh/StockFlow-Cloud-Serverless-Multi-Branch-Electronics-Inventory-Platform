import { INestApplication } from "@nestjs/common";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { EnvService } from "./config/env.service";
import { setupSwagger } from "./swagger.setup";

export function setupApp(app: INestApplication) {
  const env = app.get(EnvService);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: env.get("CORS_ORIGIN"),
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  if (env.get("SWAGGER_ENABLED")) {
    setupSwagger(app);
  }
}
