import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import {
  CreateBranchBody,
  UpdateBranchBody,
  Branch,
  createBranchSchema,
  updateBranchSchema,
} from "@stockflow/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { BranchesService } from "./branches.service";

@ApiTags("branches")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("branches")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @ApiOkResponse({ description: "Create a new branch." })
  create(@Body(new ZodValidationPipe(createBranchSchema)) body: CreateBranchBody): Promise<Branch> {
    return this.branchesService.create(body);
  }

  @Patch(":id")
  @ApiOkResponse({ description: "Update an existing branch." })
  update(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchBody,
  ): Promise<Branch> {
    return this.branchesService.update(params.id, body);
  }

  @Delete(":id")
  @ApiOkResponse({ description: "Delete or deactivate an existing branch." })
  delete(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }): Promise<void> {
    return this.branchesService.delete(params.id);
  }
}
