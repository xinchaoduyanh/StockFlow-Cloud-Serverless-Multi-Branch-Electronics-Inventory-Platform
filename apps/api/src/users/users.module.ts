import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { EnvModule } from "../config/env.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [PrismaModule, EnvModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
