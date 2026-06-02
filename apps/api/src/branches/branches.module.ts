import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { BranchesService } from "./branches.service";
import { BranchesController } from "./branches.controller";

@Module({
  imports: [PrismaModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
