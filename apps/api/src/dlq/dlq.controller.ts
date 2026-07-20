import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { DlqListQuery, dlqListQuerySchema, ImportJobDTO } from "@stockflow/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import { DlqService } from "./dlq.service";

@ApiTags("admin/dlq")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/dlq")
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @Get("imports")
  @ApiOkResponse({ description: "List failed import jobs." })
  listFailedJobs(
    @Query(new ZodValidationPipe(dlqListQuerySchema)) query: DlqListQuery,
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportJobDTO[]> {
    return this.dlqService.listFailedJobs(query, request.user);
  }

  @Post("imports/:id/replay")
  @ApiOkResponse({ description: "Replay a failed import job." })
  replay(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<any> {
    return this.dlqService.replay(params.id, request.user);
  }

  @Post("imports/:id/discard")
  @ApiOkResponse({ description: "Discard a failed import job." })
  discard(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<any> {
    return this.dlqService.discard(params.id, request.user);
  }
}
