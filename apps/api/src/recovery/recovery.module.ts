import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReportsModule } from "../reports/reports.module";
import { RecoveryController } from "./recovery.controller";
import { RecoveryService } from "./recovery.service";

@Module({
  imports: [AuthModule, ReportsModule],
  controllers: [RecoveryController],
  providers: [RecoveryService],
  exports: [RecoveryService],
})
export class RecoveryModule {}
