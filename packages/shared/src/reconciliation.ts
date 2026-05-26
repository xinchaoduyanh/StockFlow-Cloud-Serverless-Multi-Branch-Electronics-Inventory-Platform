import { z } from "zod";

// 1. Pagination base schema
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
});

// 2. Reconciliation List Query Schema & Type
export const reconciliationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["OPEN", "RESOLVED", "IGNORED"]).optional(),
});
export type ReconciliationListQuery = z.infer<typeof reconciliationListQuerySchema>;

// 3. Response DTO Types (Đầu ra)
export type ReconciliationBranch = {
  code: string;
  name: string;
};

export type ReconciliationComponent = {
  sku: string;
  name: string;
};

export type ReconciliationIssue = {
  id: string;
  expectedQuantity: number;
  actualQuantity: number;
  difference: number;
  status: string; // OPEN, RESOLVED, IGNORED
  runId: string | null;
  detectedAt: string | Date;
  resolvedAt: string | Date | null;
  branch: ReconciliationBranch;
  component: ReconciliationComponent;
};

export type ReconciliationRunResponse = {
  status: string;
  runId?: string;
  message?: string;
  totalRecords?: number;
  mismatches?: number;
};
