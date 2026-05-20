import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("StockFlow Cloud API")
    .setDescription("Serverless multi-branch electronics inventory platform API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .addTag("auth")
    .addTag("imports")
    .addTag("inventory")
    .addTag("transfers")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
