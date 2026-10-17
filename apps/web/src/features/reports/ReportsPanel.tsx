"use client";

import type { ReportType } from "@stockflow/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { ReportsTab } from "./ReportsTab";
import type { ExportJob } from "./types";

type ReportsPanelProps = {
  /** Branch the user explicitly picked in the filters; empty means no branch filter. */
  branchFilter: string;
};

export function ReportsPanel({ branchFilter }: ReportsPanelProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const exportsQuery = useQuery({
    queryKey: ["exports"],
    queryFn: () => apiRequest<ExportJob[]>("/reports/exports"),
  });

  const createExport = useMutation({
    mutationFn: (reportType: ReportType) =>
      apiRequest<ExportJob>("/reports/export", {
        method: "POST",
        body: JSON.stringify({
          reportType,
          filters: branchFilter ? { branchId: branchFilter } : undefined,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exports"] });
    },
  });

  return (
    <ReportsTab
      currentPage={page}
      exports={exportsQuery.data ?? []}
      isCreating={createExport.isPending}
      isLoading={exportsQuery.isLoading}
      onCreateExport={(type) => createExport.mutate(type)}
      onPageChange={setPage}
    />
  );
}
