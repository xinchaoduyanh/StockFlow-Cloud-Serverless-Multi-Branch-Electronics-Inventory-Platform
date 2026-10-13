import { INestApplication } from "@nestjs/common";
import { CORRELATION_ID_HEADER } from "@stockflow/shared";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JsonLogger } from "./common/logging/json-logger";
import { EnvService } from "./config/env.service";
import { setupSwagger } from "./swagger.setup";

export function setupApp(app: INestApplication) {
  const env = app.get(EnvService);

  app.useLogger(new JsonLogger());
  app.setGlobalPrefix("api");
  const corsOrigin = env.get("CORS_ORIGIN");
  const allowedOrigins = corsOrigin.includes(",")
    ? corsOrigin.split(",").map((o) => o.trim())
    : corsOrigin;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: [CORRELATION_ID_HEADER],
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  if (env.get("SWAGGER_ENABLED")) {
    setupSwagger(app);
  }
}
