import type { ExportJobStatus, ReportType } from "@stockflow/shared";

export type ExportJob = {
  id: string;
  reportType: ReportType;
  status: ExportJobStatus;
  fileName: string | null;
  totalRecords: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};
