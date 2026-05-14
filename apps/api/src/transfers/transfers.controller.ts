import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import {
  CreateTransferBody,
  createTransferBodySchema,
  RejectTransferBody,
  rejectTransferBodySchema,
  TransferListQuery,
  transferListQuerySchema,
} from "./transfers.schemas";
import { TransfersService } from "./transfers.service";

@ApiTags("transfers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @ApiBody({ description: "Create transfer and reserve source stock." })
  @ApiOkResponse({ description: "Created transfer request." })
  create(
    @Body(new ZodValidationPipe(createTransferBodySchema)) body: CreateTransferBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfersService.create(body, request.user.sub);
  }

  @Get()
  @ApiOkResponse({ description: "List transfer requests." })
  list(@Query(new ZodValidationPipe(transferListQuerySchema)) query: TransferListQuery) {
    return this.transfersService.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ description: "Get one transfer request." })
  get(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }) {
    return this.transfersService.get(params.id);
  }

  @Post(":id/approve")
  @ApiOkResponse({ description: "Approve transfer and move stock transactionally." })
  approve(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfersService.approve(params.id, request.user.sub);
  }

  @Post(":id/reject")
  @ApiBody({
    schema: {
      type: "object",
      required: ["reason"],
      properties: { reason: { type: "string", minLength: 1 } },
    },
  })
  @ApiOkResponse({ description: "Reject transfer and release reservation." })
  reject(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(rejectTransferBodySchema)) body: RejectTransferBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfersService.reject(params.id, body, request.user.sub);
  }

  @Post(":id/cancel")
  @ApiOkResponse({ description: "Cancel transfer and release reservation." })
  cancel(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfersService.cancel(params.id, request.user.sub);
  }
}
