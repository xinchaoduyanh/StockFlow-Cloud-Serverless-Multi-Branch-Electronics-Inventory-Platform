"use client";

import type { ReconciliationIssue, ReconciliationStatus } from "@stockflow/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { ReconciliationTab } from "./ReconciliationTab";

export function ReconciliationPanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | "">("");

  const issuesQuery = useQuery({
    queryKey: ["reconciliation", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      return apiRequest<ReconciliationIssue[]>(`/reconciliation/issues?${params.toString()}`);
    },
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
      issues={issuesQuery.data ?? []}
      onPageChange={setPage}
      onResolve={(id) => resolveIssue.mutate(id)}
      onRun={() => runReconciliation.mutate()}
      onStatusFilterChange={setStatusFilter}
      statusFilter={statusFilter}
    />
  );
}
