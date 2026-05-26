import { z } from "zod";
import { ComponentCategory } from "./index";
import { paginationQuerySchema } from "./reconciliation";

export const importRowInputSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  brand: z.string().trim().optional(),
  category: z.nativeEnum(ComponentCategory),
  quantity: z.number().int().positive("quantity must be greater than 0"),
  unitPrice: z.number().min(0).optional(),
  supplier: z.string().trim().optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  ddrGeneration: z.enum(["DDR3", "DDR4", "DDR5"]).optional(),
  speedMhz: z.number().int().positive().optional(),
  capacityGb: z.number().int().positive().optional(),
  socket: z.string().trim().optional(),
  cores: z.number().int().positive().optional(),
  threads: z.number().int().positive().optional(),
  interface: z.enum(["NVMe", "SATA"]).optional(),
  formFactor: z.string().trim().optional(),
  vramGb: z.number().int().positive().optional(),
  chipset: z.string().trim().optional(),
  wattage: z.number().int().positive().optional(),
  efficiencyRating: z.string().trim().optional(),
  modular: z.string().trim().optional(),
  caseSize: z.string().trim().optional(),
  supportedMainboard: z.string().trim().optional(),
  coolerType: z.string().trim().optional(),
  supportedSocket: z.string().trim().optional(),
});

export const initImportBodySchema = z.object({
  branchId: z.string().uuid(),
  fileName: z.string().trim().min(1),
  s3Key: z.string().trim().optional(),
  rows: z.array(importRowInputSchema).optional(),
});

export const startImportBodySchema = z.object({
  rows: z.array(importRowInputSchema).min(1),
});

export const importListQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
});

export const uploadImportBodySchema = z.object({
  branchId: z.string().uuid(),
});

export const presignedPostRequestSchema = z.object({
  branchId: z.string().uuid(),
  fileName: z
    .string()
    .trim()
    .min(1)
    .regex(/\.xlsx$/i, "Only .xlsx files are supported"),
  contentType: z
    .string()
    .trim()
    .default("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
});

export type ImportRowInput = z.infer<typeof importRowInputSchema>;
export type InitImportBody = z.infer<typeof initImportBodySchema>;
export type StartImportBody = z.infer<typeof startImportBodySchema>;
export type ImportListQuery = z.infer<typeof importListQuerySchema>;
export type UploadImportBody = z.infer<typeof uploadImportBodySchema>;
export type PresignedPostRequest = z.infer<typeof presignedPostRequestSchema>;

// Output DTOs
export interface ImportJobDTO {
  id: string;
  branchId: string;
  status: string;
  fileName: string | null;
  s3Key: string | null;
  totalRows: number;
  processedRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number | null;
  errorMessage?: string | null;
  createdBy: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  branch?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface PresignedPostResponse {
  importJobId: string;
  presignedPost: {
    url: string;
    fields: Record<string, string>;
  };
}

export interface ImportPreviewRowDTO {
  id: string;
  rowNumber: number;
  sku: string | null;
  validationStatus: string;
  errorMessage: string | null;
  normalizedData: any;
  rawData?: any;
}
