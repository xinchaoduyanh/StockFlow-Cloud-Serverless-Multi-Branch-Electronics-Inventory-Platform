"use client";

import type { Paginated, ReportType } from "@stockflow/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
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
    queryKey: ["exports", page],
    queryFn: () =>
      apiRequest<Paginated<ExportJob>>(`/reports/exports?page=${page}&limit=${TABLE_PAGE_SIZE}`),
    placeholderData: keepPreviousData,
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
      exports={exportsQuery.data?.items ?? []}
      total={exportsQuery.data?.total ?? 0}
      isCreating={createExport.isPending}
      isLoading={exportsQuery.isLoading}
      onCreateExport={(type) => createExport.mutate(type)}
      onPageChange={setPage}
    />
  );
}
