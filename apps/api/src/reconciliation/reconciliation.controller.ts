import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Req } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  ReconciliationListQuery,
  reconciliationListQuerySchema,
  ReconciliationIssue,
  ReconciliationRunResponse,
} from "@stockflow/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import { ReconciliationService } from "./reconciliation.service";

@ApiTags("reconciliation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get("issues")
  @ApiOkResponse({ description: "List reconciliation issues." })
  listIssues(
    @Query(new ZodValidationPipe(reconciliationListQuerySchema))
    query: ReconciliationListQuery,
    @Req() request: AuthenticatedRequest,
  ): Promise<ReconciliationIssue[]> {
    return this.reconciliationService.listIssues(query, request.user);
  }

  @Post("run")
  @ApiOkResponse({ description: "Trigger reconciliation run." })
  run(@Req() request: AuthenticatedRequest): Promise<ReconciliationRunResponse> {
    return this.reconciliationService.run(request.user);
  }

  @Post("issues/:id/resolve")
  @ApiOkResponse({ description: "Resolve a reconciliation issue." })
  resolve(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<ReconciliationIssue> {
    return this.reconciliationService.resolve(params.id, request.user);
  }
}
