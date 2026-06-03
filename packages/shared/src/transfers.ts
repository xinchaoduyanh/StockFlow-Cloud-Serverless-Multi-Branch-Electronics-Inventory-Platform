import { z } from "zod";
import { paginationQuerySchema } from "./reconciliation";

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

// Output DTOs
export interface TransferItemDTO {
  transferId: string;
  componentId: string;
  quantity: number;
  component: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    category: string;
  };
}

export interface TransferDTO {
  id: string;
  fromBranchId: string;
  toBranchId: string;
  status: string;
  createdBy: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  note: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  fromBranch: { id: string; code: string; name: string };
  toBranch: { id: string; code: string; name: string };
  items: TransferItemDTO[];
  requestedByUser?: {
    id: string;
    fullName: string | null;
    role: string;
    branch: { id: string; code: string; name: string } | null;
  } | null;
  approvedByUser?: {
    id: string;
    fullName: string | null;
    role: string;
  } | null;
  rejectedByUser?: {
    id: string;
    fullName: string | null;
    role: string;
  } | null;
}
