import { ComponentCategory } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas/pagination.schema";

export const inventoryQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
  category: z.nativeEnum(ComponentCategory).optional(),
  search: z.string().trim().min(1).optional(),
  lowStock: z.coerce.boolean().optional(),
});

export const adjustInventoryBodySchema = z.object({
  branchId: z.string().uuid(),
  componentId: z.string().uuid(),
  quantityChange: z.number().int(),
  minStockThreshold: z.number().int().min(0).optional(),
});

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type AdjustInventoryBody = z.infer<typeof adjustInventoryBodySchema>;
