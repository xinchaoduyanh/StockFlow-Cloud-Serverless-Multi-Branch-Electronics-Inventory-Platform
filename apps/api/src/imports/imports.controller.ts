import { Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import {
  ImportListQuery,
  importListQuerySchema,
  InitImportBody,
  initImportBodySchema,
  StartImportBody,
  startImportBodySchema,
  UploadImportBody,
  uploadImportBodySchema,
} from "./imports.schemas";
import { ImportsService } from "./imports.service";

@ApiTags("imports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("imports")
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post("init")
  @ApiBody({ description: "Create an import job. Rows are optional for local JSON preview mode." })
  @ApiOkResponse({ description: "Created import job." })
  init(
    @Body(new ZodValidationPipe(initImportBodySchema)) body: InitImportBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importsService.init(body, request.user.sub);
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["branchId", "file"],
      properties: {
        branchId: { type: "string", format: "uuid" },
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiOkResponse({ description: "Created import job and parsed Excel preview rows." })
  upload(
    @Body(new ZodValidationPipe(uploadImportBodySchema)) body: UploadImportBody,
    @UploadedFile() file: Express.Multer.File,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importsService.upload(body.branchId, file, request.user.sub);
  }

  @Post(":id/start")
  @ApiBody({ description: "Attach rows and generate preview in local JSON mode." })
  @ApiOkResponse({ description: "Import preview is ready." })
  start(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(startImportBodySchema)) body: StartImportBody,
  ) {
    return this.importsService.start(params.id, body);
  }

  @Get()
  @ApiOkResponse({ description: "List import jobs." })
  list(@Query(new ZodValidationPipe(importListQuerySchema)) query: ImportListQuery) {
    return this.importsService.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ description: "Get one import job." })
  get(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.importsService.get(params.id);
  }

  @Get(":id/progress")
  @ApiOkResponse({ description: "Get import progress counters." })
  progress(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.importsService.progress(params.id);
  }

  @Get(":id/errors")
  @ApiOkResponse({ description: "Get invalid import rows." })
  errors(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.importsService.errors(params.id);
  }

  @Get(":id/preview")
  @ApiOkResponse({ description: "Get import preview rows." })
  preview(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.importsService.preview(params.id);
  }

  @Post(":id/confirm")
  @ApiOkResponse({ description: "Commit valid preview rows into inventory." })
  confirm(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importsService.confirm(params.id, request.user.sub);
  }

  @Post(":id/cancel")
  @ApiOkResponse({ description: "Cancel import job." })
  cancel(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.importsService.cancel(params.id);
  }

  @Post(":id/retry-failed-rows")
  @ApiOkResponse({ description: "Placeholder for future DLQ/SQS retry integration." })
  retryFailedRows(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.importsService.progress(params.id);
  }
}
