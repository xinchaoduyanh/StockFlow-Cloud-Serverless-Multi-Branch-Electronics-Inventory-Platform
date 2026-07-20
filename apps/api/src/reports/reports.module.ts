import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ImportsModule } from "../imports/imports.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportDispatcher } from "./report-dispatcher";

@Module({
  imports: [ImportsModule, AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportDispatcher],
  exports: [ReportDispatcher],
})
export class ReportsModule {}
