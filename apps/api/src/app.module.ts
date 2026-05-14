import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { EnvModule } from "./config/env.module";
import { PrismaModule } from "./database/prisma.module";
import { ImportsModule } from "./imports/imports.module";
import { InventoryModule } from "./inventory/inventory.module";
import { TransfersModule } from "./transfers/transfers.module";

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    AuthModule,
    ImportsModule,
    InventoryModule,
    TransfersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
