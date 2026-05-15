import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { branchIdParamSchema, skuParamSchema } from "../common/schemas/params.schema";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  AdjustInventoryBody,
  adjustInventoryBodySchema,
  InventoryQuery,
  inventoryQuerySchema,
} from "./inventory.schemas";
import { InventoryService } from "./inventory.service";

@ApiTags("inventory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("inventory")
  @ApiOkResponse({ description: "List inventory across branches." })
  list(@Query(new ZodValidationPipe(inventoryQuerySchema)) query: InventoryQuery) {
    return this.inventoryService.list(query);
  }

  @Get("inventory/:sku")
  @ApiOkResponse({ description: "List inventory records for a SKU." })
  getBySku(@Param(new ZodValidationPipe(skuParamSchema)) params: { sku: string }) {
    return this.inventoryService.getBySku(params.sku);
  }

  @Get("branches")
  @ApiOkResponse({ description: "List branches for inventory workflows." })
  listBranches() {
    return this.inventoryService.listBranches();
  }

  @Get("branches/:branchId/inventory")
  @ApiOkResponse({ description: "List inventory for one branch." })
  listByBranch(
    @Param(new ZodValidationPipe(branchIdParamSchema)) params: { branchId: string },
    @Query(new ZodValidationPipe(inventoryQuerySchema.omit({ branchId: true })))
    query: Omit<InventoryQuery, "branchId">,
  ) {
    return this.inventoryService.listByBranch(params.branchId, query);
  }

  @Patch("inventory/adjust")
  @ApiBody({
    schema: {
      type: "object",
      required: ["branchId", "componentId", "quantityChange"],
      properties: {
        branchId: { type: "string", format: "uuid" },
        componentId: { type: "string", format: "uuid" },
        quantityChange: { type: "integer" },
        minStockThreshold: { type: "integer", minimum: 0 },
      },
    },
  })
  @ApiOkResponse({ description: "Adjust one inventory record." })
  adjust(
    @Body(new ZodValidationPipe(adjustInventoryBodySchema))
    body: AdjustInventoryBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.adjust(body, request.user.sub);
  }
}
