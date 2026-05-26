import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas/pagination.schema";

export const dlqListQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
});

export type DlqListQuery = z.infer<typeof dlqListQuerySchema>;
