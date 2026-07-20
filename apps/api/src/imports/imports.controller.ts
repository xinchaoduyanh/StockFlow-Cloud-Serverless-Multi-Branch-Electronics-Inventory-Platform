import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  ImportListQuery,
  importListQuerySchema,
  InitImportBody,
  initImportBodySchema,
  StartImportBody,
  startImportBodySchema,
  UploadImportBody,
  uploadImportBodySchema,
  PresignedPostRequest,
  presignedPostRequestSchema,
  PresignedPostResponse,
  ImportJobDTO,
  ImportPreviewRowDTO,
} from "@stockflow/shared";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import { ImportsService } from "./imports.service";

@ApiTags("imports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("imports")
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post("presigned-post")
  @ApiBody({ description: "Generate S3 Presigned POST fields for client-side direct uploads." })
  @ApiOkResponse({ description: "Returns S3 url, fields and the corresponding importJobId." })
  presignedPost(
    @Body(new ZodValidationPipe(presignedPostRequestSchema)) body: PresignedPostRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<PresignedPostResponse> {
    return this.importsService.getPresignedPost(body, request.user.sub, request.user);
  }

  @Post("init")
  @ApiBody({ description: "Create an import job. Rows are optional for local JSON preview mode." })
  @ApiOkResponse({ description: "Created import job." })
  init(
    @Body(new ZodValidationPipe(initImportBodySchema)) body: InitImportBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportJobDTO> {
    return this.importsService.init(body, request.user.sub, request.user);
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
  ): Promise<ImportJobDTO> {
    return this.importsService.upload(body.branchId, file, request.user.sub, request.user);
  }

  @Post(":id/start")
  @ApiBody({ description: "Attach rows and generate preview in local JSON mode." })
  @ApiOkResponse({ description: "Import preview is ready." })
  start(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(startImportBodySchema)) body: StartImportBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportJobDTO> {
    return this.importsService.start(params.id, body, request.user);
  }

  @Get()
  @ApiOkResponse({ description: "List import jobs." })
  list(
    @Query(new ZodValidationPipe(importListQuerySchema)) query: ImportListQuery,
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportJobDTO[]> {
    return this.importsService.list(query, request.user);
  }

  @Get(":id")
  @ApiOkResponse({ description: "Get one import job." })
  get(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportJobDTO> {
    return this.importsService.get(params.id, request.user);
  }

  @Get(":id/progress")
  @ApiOkResponse({ description: "Get import progress counters." })
  progress(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<any> {
    return this.importsService.progress(params.id, request.user);
  }

  @Get(":id/errors")
  @ApiOkResponse({ description: "Get invalid import rows." })
  errors(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportPreviewRowDTO[]> {
    return this.importsService.errors(params.id, request.user);
  }

  @Get(":id/preview")
  @ApiOkResponse({ description: "Get import preview rows." })
  preview(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportPreviewRowDTO[]> {
    return this.importsService.preview(params.id, request.user);
  }

  @Post(":id/confirm")
  @ApiOkResponse({ description: "Commit valid preview rows into inventory." })
  confirm(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportJobDTO> {
    return this.importsService.confirm(params.id, request.user.sub, request.user);
  }

  @Post(":id/cancel")
  @ApiOkResponse({ description: "Cancel import job." })
  cancel(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportJobDTO> {
    return this.importsService.cancel(params.id, request.user);
  }

  @Post(":id/retry-failed-rows")
  @ApiOkResponse({ description: "Placeholder for future DLQ/SQS retry integration." })
  retryFailedRows(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ): Promise<any> {
    return this.importsService.progress(params.id, request.user);
  }
}
