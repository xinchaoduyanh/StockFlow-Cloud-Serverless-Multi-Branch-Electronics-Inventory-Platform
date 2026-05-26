import { Module } from "@nestjs/common";
import { ImportsModule } from "../imports/imports.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [ImportsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
