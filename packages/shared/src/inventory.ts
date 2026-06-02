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
  address: string | null;
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

export const createBranchSchema = z.object({
  code: z.string().trim().min(2).max(50).toUpperCase(),
  name: z.string().trim().min(3).max(255),
  address: z.string().trim().min(5).max(500).optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().trim().min(3).max(255).optional(),
  address: z.string().trim().min(5).max(500).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type CreateBranchBody = z.infer<typeof createBranchSchema>;
export type UpdateBranchBody = z.infer<typeof updateBranchSchema>;
