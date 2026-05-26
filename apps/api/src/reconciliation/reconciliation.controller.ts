import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import {
  ReconciliationListQuery,
  reconciliationListQuerySchema,
} from "./reconciliation.schemas";
import { ReconciliationService } from "./reconciliation.service";

@ApiTags("reconciliation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get("issues")
  @ApiOkResponse({ description: "List reconciliation issues." })
  listIssues(
    @Query(new ZodValidationPipe(reconciliationListQuerySchema))
    query: ReconciliationListQuery,
  ) {
    return this.reconciliationService.listIssues(query);
  }

  @Post("run")
  @ApiOkResponse({ description: "Trigger reconciliation run." })
  run() {
    return this.reconciliationService.run();
  }

  @Post("issues/:id/resolve")
  @ApiOkResponse({ description: "Resolve a reconciliation issue." })
  resolve(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.reconciliationService.resolve(params.id);
  }
}
