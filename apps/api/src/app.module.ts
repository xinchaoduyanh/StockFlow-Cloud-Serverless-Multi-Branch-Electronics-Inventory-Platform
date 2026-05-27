import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { HttpLoggerMiddleware } from "./common/middleware/http-logger.middleware";
import { EnvModule } from "./config/env.module";
import { PrismaModule } from "./database/prisma.module";
import { DlqModule } from "./dlq/dlq.module";
import { ImportsModule } from "./imports/imports.module";
import { InventoryModule } from "./inventory/inventory.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { ReportsModule } from "./reports/reports.module";
import { TransfersModule } from "./transfers/transfers.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    AuthModule,
    ImportsModule,
    InventoryModule,
    TransfersModule,
    ReportsModule,
    DlqModule,
    ReconciliationModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes("*");
  }
}
