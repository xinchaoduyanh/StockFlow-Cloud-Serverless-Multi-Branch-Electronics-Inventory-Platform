import { z } from "zod";
import { paginationQuerySchema } from "./reconciliation";

export const dlqListQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
});

export type DlqListQuery = z.infer<typeof dlqListQuerySchema>;
