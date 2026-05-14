import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas/pagination.schema";

export const transferItemSchema = z.object({
  componentId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createTransferBodySchema = z
  .object({
    fromBranchId: z.string().uuid(),
    toBranchId: z.string().uuid(),
    note: z.string().trim().optional(),
    items: z.array(transferItemSchema).min(1),
  })
  .refine((value) => value.fromBranchId !== value.toBranchId, {
    path: ["toBranchId"],
    message: "Destination branch must be different from source branch",
  });

export const rejectTransferBodySchema = z.object({
  reason: z.string().trim().min(1),
});

export const transferListQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
});

export type CreateTransferBody = z.infer<typeof createTransferBodySchema>;
export type RejectTransferBody = z.infer<typeof rejectTransferBodySchema>;
export type TransferListQuery = z.infer<typeof transferListQuerySchema>;
