import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import { DlqListQuery, dlqListQuerySchema } from "./dlq.schemas";
import { DlqService } from "./dlq.service";

@ApiTags("admin/dlq")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin/dlq")
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @Get("imports")
  @ApiOkResponse({ description: "List failed import jobs." })
  listFailedJobs(@Query(new ZodValidationPipe(dlqListQuerySchema)) query: DlqListQuery) {
    return this.dlqService.listFailedJobs(query);
  }

  @Post("imports/:id/replay")
  @ApiOkResponse({ description: "Replay a failed import job." })
  replay(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.dlqService.replay(params.id);
  }

  @Post("imports/:id/discard")
  @ApiOkResponse({ description: "Discard a failed import job." })
  discard(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.dlqService.discard(params.id);
  }
}
