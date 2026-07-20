"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { apiRequest } from "@/lib/api-client";

type ReportRecovery = {
  id: string;
  reportType: string;
  status: string;
  attemptCount: number;
  lastErrorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};
type ImportRecovery = {
  id: string;
  importJobId: string;
  terminalStatus: string;
  status: string;
  replayCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};
type Metrics = {
  source: {
    availableMessages: number;
    inFlightMessages: number;
    oldestMessageAgeSeconds: number | null;
  };
  dlq: {
    availableMessages: number;
    inFlightMessages: number;
    oldestMessageAgeSeconds: number | null;
  };
};

export function RecoveryTab() {
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["recovery-reports"],
    queryFn: () => apiRequest<ReportRecovery[]>("/admin/recovery/reports"),
  });
  const imports = useQuery({
    queryKey: ["recovery-imports"],
    queryFn: () => apiRequest<ImportRecovery[]>("/admin/recovery/imports"),
  });
  const metrics = useQuery({
    queryKey: ["recovery-report-metrics"],
    queryFn: () => apiRequest<Metrics>("/admin/recovery/reports/queue"),
  });
  const action = useMutation({
    mutationFn: ({ path, reason }: { path: string; reason: string }) =>
      apiRequest(path, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recovery-reports"] });
      void queryClient.invalidateQueries({ queryKey: ["recovery-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["recovery-report-metrics"] });
    },
  });
  const confirmAction = (path: string) => {
    const reason = window.prompt("Nhập lý do thao tác khôi phục:");
    if (reason?.trim()) action.mutate({ path, reason: reason.trim() });
  };

  return (
    <section className="grid gap-4 animate-rise-in-delay-1">
      <div className="surface p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Khôi phục sự cố
            </h2>
            <p className="m-0 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Chỉ hiển thị metadata an toàn; payload và receipt handle không đi vào console.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <Metric label="Queue" value={metrics.data?.source.availableMessages ?? 0} />
            <Metric label="DLQ" value={metrics.data?.dlq.availableMessages ?? 0} danger />
            <button
              className="button-small-secondary col-span-2"
              type="button"
              onClick={() => confirmAction("/admin/recovery/reports/dlq/redrive")}
              disabled={action.isPending || !metrics.data?.dlq.availableMessages}
            >
              Redrive report DLQ
            </button>
          </div>
        </div>
      </div>

      <RecoveryTable
        title="Report recovery"
        empty="Không có report lỗi."
        items={reports.data ?? []}
        loading={reports.isLoading}
      >
        {(item) => (
          <tr key={item.id}>
            <td>{item.reportType}</td>
            <td>
              <span className="font-medium">{item.status}</span>
              <div className="text-xs text-slate-500">attempt {item.attemptCount}</div>
            </td>
            <td>{item.errorMessage ?? item.lastErrorCode ?? "—"}</td>
            <td className="text-xs text-slate-500">
              {new Date(item.createdAt).toLocaleString("vi-VN", { hour12: false })}
            </td>
            <td>
              <div className="flex gap-2">
                <button
                  className="button-small-primary"
                  type="button"
                  onClick={() => confirmAction(`/admin/recovery/reports/${item.id}/replay`)}
                  disabled={action.isPending || item.status !== "FAILED"}
                >
                  Thử lại
                </button>
                <button
                  className="button-small-secondary"
                  type="button"
                  onClick={() => confirmAction(`/admin/recovery/reports/${item.id}/discard`)}
                  disabled={action.isPending || item.status !== "FAILED"}
                >
                  Bỏ qua
                </button>
              </div>
            </td>
          </tr>
        )}
      </RecoveryTable>

      <RecoveryTable
        title="Import recovery"
        empty="Không có execution lỗi."
        items={imports.data ?? []}
        loading={imports.isLoading}
      >
        {(item) => (
          <tr key={item.id}>
            <td className="font-mono text-xs">{item.importJobId.slice(0, 8)}…</td>
            <td>
              <span className="font-medium">{item.terminalStatus}</span>
              <div className="text-xs text-slate-500">
                {item.status}, replay {item.replayCount}/3
              </div>
            </td>
            <td>{item.errorMessage ?? item.errorCode ?? "—"}</td>
            <td className="text-xs text-slate-500">
              {new Date(item.createdAt).toLocaleString("vi-VN", { hour12: false })}
            </td>
            <td>
              <div className="flex gap-2">
                <button
                  className="button-small-primary"
                  type="button"
                  onClick={() => confirmAction(`/admin/recovery/imports/${item.id}/replay`)}
                  disabled={action.isPending || item.status !== "OPEN"}
                >
                  Thử lại
                </button>
                <button
                  className="button-small-secondary"
                  type="button"
                  onClick={() => confirmAction(`/admin/recovery/imports/${item.id}/discard`)}
                  disabled={action.isPending || item.status !== "OPEN"}
                >
                  Bỏ qua
                </button>
              </div>
            </td>
          </tr>
        )}
      </RecoveryTable>
    </section>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${danger ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-slate-50 text-slate-800"}`}
    >
      <div>{label}</div>
      <strong className="text-lg">{value}</strong>
    </div>
  );
}

function RecoveryTable<T extends { id: string }>({
  title,
  empty,
  items,
  loading,
  children,
}: {
  title: string;
  empty: string;
  items: T[];
  loading: boolean;
  children: (item: T) => ReactNode;
}) {
  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
        <h3 className="m-0 text-sm font-semibold text-slate-950 dark:text-white">
          {title} <span className="text-slate-400">({items.length})</span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>State</th>
              <th>Error</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-slate-500">
                  Đang tải…
                </td>
              </tr>
            ) : items.length ? (
              items.map(children)
            ) : (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-slate-500">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
