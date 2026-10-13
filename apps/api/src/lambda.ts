import { NestFactory } from "@nestjs/core";
import serverlessExpress from "@codegenie/serverless-express";
import { ensureDatabaseUrl } from "@stockflow/shared/dist/database-url";
import type { Handler } from "aws-lambda";
import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";

// Không khởi động OpenTelemetry (tracing.ts): trên Lambda không có collector,
// trace đi qua X-Ray active tracing.
async function bootstrapServer(): Promise<Handler> {
  // EnvService validate DATABASE_URL ngay khi khởi tạo, nên phải nạp từ SSM trước.
  await ensureDatabaseUrl();

  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

// Chỉ bootstrap NestJS ở cold start; các lần invoke sau dùng lại server.
let server: Promise<Handler> | undefined;

export const handler: Handler = async (event, context, callback) => {
  server ??= bootstrapServer().catch((error: unknown) => {
    server = undefined; // lỗi lúc khởi động (SSM, env) thì lần invoke sau thử lại
    throw error;
  });
  const serverHandler = await server;
  return serverHandler(event, context, callback);
};
