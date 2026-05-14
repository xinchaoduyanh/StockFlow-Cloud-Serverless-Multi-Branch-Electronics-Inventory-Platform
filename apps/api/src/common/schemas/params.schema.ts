import { z } from "zod";

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const branchIdParamSchema = z.object({
  branchId: z.string().uuid(),
});

export const skuParamSchema = z.object({
  sku: z.string().min(1),
});
