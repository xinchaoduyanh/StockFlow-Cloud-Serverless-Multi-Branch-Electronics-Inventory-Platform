import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  importRecoveryListQuerySchema,
  recoveryActionBodySchema,
  reportDlqRedriveBodySchema,
  reportRecoveryListQuerySchema,
} from "@stockflow/shared";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import { RecoveryService } from "./recovery.service";

@ApiTags("admin/recovery")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/recovery")
export class RecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get("reports")
  listReports(
    @Query(new ZodValidationPipe(reportRecoveryListQuerySchema)) query: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.recovery.listReports(query, req.user);
  }

  @Get("reports/queue")
  reportQueue(@Req() req: AuthenticatedRequest) {
    return this.recovery.reportQueueMetrics(req.user);
  }

  @Post("reports/:id/replay")
  replayReport(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(recoveryActionBodySchema)) body: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.recovery.replayReport(params.id, body, req.user);
  }

  @Post("reports/:id/discard")
  discardReport(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(recoveryActionBodySchema)) body: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.recovery.discardReport(params.id, body, req.user);
  }

  @Post("reports/dlq/redrive")
  redriveReportDlq(
    @Body(new ZodValidationPipe(reportDlqRedriveBodySchema)) body: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.recovery.redriveReportDlq(body, req.user);
  }

  @Get("imports")
  listImports(
    @Query(new ZodValidationPipe(importRecoveryListQuerySchema)) query: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.recovery.listImportRecovery(query, req.user);
  }

  @Post("imports/:id/replay")
  replayImport(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(recoveryActionBodySchema)) body: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.recovery.replayImport(params.id, body, req.user);
  }

  @Post("imports/:id/discard")
  discardImport(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(recoveryActionBodySchema)) body: any,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.recovery.discardImport(params.id, body, req.user);
  }
}
