import { z } from "zod";
import { ComponentCategory } from "./index";
import { paginationQuerySchema } from "./reconciliation";

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

// Output DTOs
export interface Branch {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Component {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string;
  unitPrice: number;
  supplier: string | null;
  warrantyMonths: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface InventoryItem {
  branchId: string;
  componentId: string;
  quantity: number;
  minStockThreshold: number;
  version: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  branch: Branch;
  component: Component;
}
