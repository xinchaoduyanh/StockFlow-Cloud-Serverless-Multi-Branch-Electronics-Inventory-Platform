import { INestApplication } from "@nestjs/common";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { EnvService } from "./config/env.service";
import { setupSwagger } from "./swagger.setup";

export function setupApp(app: INestApplication) {
  const env = app.get(EnvService);

  app.setGlobalPrefix("api");
  const corsOrigin = env.get("CORS_ORIGIN");
  const allowedOrigins = corsOrigin.includes(",")
    ? corsOrigin.split(",").map((o) => o.trim())
    : corsOrigin;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  if (env.get("SWAGGER_ENABLED")) {
    setupSwagger(app);
  }
}
