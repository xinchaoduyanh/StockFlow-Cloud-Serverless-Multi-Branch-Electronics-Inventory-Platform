import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas/pagination.schema";

export const createExportBodySchema = z.object({
  reportType: z.enum(["inventory", "low-stock", "transfers", "import-history", "stock-movements"]),
  filters: z
    .object({
      branchId: z.string().uuid().optional(),
      status: z.string().optional(),
      movementType: z.string().optional(),
    })
    .optional(),
});

export type CreateExportBody = z.infer<typeof createExportBodySchema>;

export const exportListQuerySchema = paginationQuerySchema;
export type ExportListQuery = z.infer<typeof exportListQuerySchema>;
