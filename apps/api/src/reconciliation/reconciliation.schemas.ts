import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas/pagination.schema";

export const reconciliationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["OPEN", "RESOLVED", "IGNORED"]).optional(),
});

export type ReconciliationListQuery = z.infer<typeof reconciliationListQuerySchema>;
