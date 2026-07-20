import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";
import { S3Service } from "./s3.service";

@Module({
  imports: [AuthModule],
  controllers: [ImportsController],
  providers: [ImportsService, S3Service],
  exports: [S3Service],
})
export class ImportsModule {}
