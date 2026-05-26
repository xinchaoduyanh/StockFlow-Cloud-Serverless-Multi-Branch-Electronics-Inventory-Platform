import { z } from "zod";
import { REPORT_TYPES } from "./index";
import { paginationQuerySchema } from "./reconciliation";

export const createExportBodySchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  filters: z
    .object({
      branchId: z.string().uuid().optional(),
      status: z.string().optional(),
      movementType: z.string().optional(),
    })
    .optional(),
});

export const exportListQuerySchema = paginationQuerySchema;

export type CreateExportBody = z.infer<typeof createExportBodySchema>;
export type ExportListQuery = z.infer<typeof exportListQuerySchema>;

export interface ExportJobDTO {
  id: string;
  reportType: string;
  status: string;
  s3Key: string | null;
  fileName: string | null;
  totalRecords: number | null;
  errorMessage: string | null;
  completedAt: string | Date | null;
  createdBy: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
