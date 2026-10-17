import type { ImportRowStatus, ImportStatus } from "@stockflow/shared";
import type { BranchRef } from "@/features/branches/types";

export type ImportJob = {
  id: string;
  fileName: string | null;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  createdAt: string;
  branch: BranchRef;
};

export type ImportPreviewRow = {
  id: string;
  rowNumber: number;
  sku: string | null;
  validationStatus: ImportRowStatus;
  errorMessage: string | null;
  normalizedData: Record<string, unknown> | null;
};
