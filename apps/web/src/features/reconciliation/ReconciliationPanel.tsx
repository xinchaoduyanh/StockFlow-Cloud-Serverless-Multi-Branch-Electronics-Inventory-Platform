"use client";

import type { Paginated, ReconciliationIssue, ReconciliationStatus } from "@stockflow/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import { ReconciliationTab } from "./ReconciliationTab";

export function ReconciliationPanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | "">("");

  const issuesQuery = useQuery({
    queryKey: ["reconciliation", statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(TABLE_PAGE_SIZE) });
      if (statusFilter) params.set("status", statusFilter);
      return apiRequest<Paginated<ReconciliationIssue>>(
        `/reconciliation/issues?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });

  function refreshIssues() {
    void queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
  }

  const runReconciliation = useMutation({
    mutationFn: () => apiRequest("/reconciliation/run", { method: "POST" }),
    onSuccess: refreshIssues,
  });

  const resolveIssue = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/reconciliation/issues/${id}/resolve`, { method: "POST" }),
    onSuccess: refreshIssues,
  });

  return (
    <ReconciliationTab
      currentPage={page}
      isLoading={issuesQuery.isLoading}
      isRunning={runReconciliation.isPending}
      issues={issuesQuery.data?.items ?? []}
      total={issuesQuery.data?.total ?? 0}
      onPageChange={setPage}
      onResolve={(id) => resolveIssue.mutate(id)}
      onRun={() => runReconciliation.mutate()}
      onStatusFilterChange={(status) => {
        setStatusFilter(status);
        setPage(1);
      }}
      statusFilter={statusFilter}
    />
  );
}
