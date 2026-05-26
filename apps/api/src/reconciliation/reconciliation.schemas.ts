import { RECONCILIATION_STATUSES } from "@stockflow/shared";
import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas/pagination.schema";

export const reconciliationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(RECONCILIATION_STATUSES).optional(),
});

export type ReconciliationListQuery = z.infer<typeof reconciliationListQuerySchema>;
