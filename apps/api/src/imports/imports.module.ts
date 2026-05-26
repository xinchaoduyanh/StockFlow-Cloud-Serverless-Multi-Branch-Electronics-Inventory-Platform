import { Module } from "@nestjs/common";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";
import { S3Service } from "./s3.service";

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, S3Service],
  exports: [S3Service],
})
export class ImportsModule {}
