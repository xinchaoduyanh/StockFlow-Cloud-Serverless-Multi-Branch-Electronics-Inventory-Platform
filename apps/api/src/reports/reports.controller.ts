import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  CreateExportBody,
  createExportBodySchema,
  ExportListQuery,
  exportListQuerySchema,
  ExportJobDTO,
} from "@stockflow/shared";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post("export")
  @ApiOkResponse({ description: "Create an export job." })
  createExport(
    @Body(new ZodValidationPipe(createExportBodySchema)) body: CreateExportBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExportJobDTO> {
    return this.reportsService.createExport(body, request.user.sub);
  }

  @Get("exports")
  @ApiOkResponse({ description: "List export jobs." })
  listExports(
    @Query(new ZodValidationPipe(exportListQuerySchema)) query: ExportListQuery,
  ): Promise<ExportJobDTO[]> {
    return this.reportsService.listExports(query);
  }

  @Get("export/:id")
  @ApiOkResponse({ description: "Get export job status." })
  getExport(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
  ): Promise<ExportJobDTO> {
    return this.reportsService.getExport(params.id);
  }

  @Get("export/:id/download")
  @ApiOkResponse({ description: "Get presigned download URL for completed export." })
  getDownloadUrl(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
  ): Promise<any> {
    return this.reportsService.getDownloadUrl(params.id);
  }
}
