import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { EmailService } from "./email.service";
import { NotificationsController } from "./notifications.controller";
import { PrismaModule } from "../database/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
