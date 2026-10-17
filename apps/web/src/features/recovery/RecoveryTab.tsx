"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { ReasonDialog } from "@/components/ReasonDialog";
import { TableState } from "@/components/table/TablePieces";

const MAX_IMPORT_REPLAYS = 3;

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

type PendingAction = { path: string; title: string; description: string };

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { hour12: false });
}

export function RecoveryTab() {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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

  function askReason(path: string, title: string, description: string) {
    setPendingAction({ path, title, description });
  }

  return (
    <section className="grid gap-4 animate-rise-in-delay-1">
      <div className="surface p-5">
        <div className="flex items-center justify-between gap-6 max-md:flex-col max-md:items-start">
          <div className="grid gap-1.5">
            <h2 className="m-0 font-display text-lg font-semibold tracking-tight">
              Khôi phục sự cố
            </h2>
            <p className="m-0 max-w-[56ch] text-sm text-[var(--color-text-secondary)]">
              Chỉ hiển thị thông tin an toàn của tác vụ. Nội dung message và receipt handle không
              đưa lên giao diện.
            </p>
          </div>
          <div className="grid min-w-64 grid-cols-2 gap-2">
            <Metric label="Hàng đợi" value={metrics.data?.source.availableMessages ?? 0} />
            <Metric label="DLQ" value={metrics.data?.dlq.availableMessages ?? 0} danger />
            <button
              className="button-small-secondary col-span-2"
              disabled={action.isPending || !metrics.data?.dlq.availableMessages}
              onClick={() =>
                askReason(
                  "/admin/recovery/reports/dlq/redrive",
                  "Đẩy lại các báo cáo trong DLQ",
                  "Toàn bộ message báo cáo đang nằm trong DLQ sẽ được đưa về hàng đợi chính.",
                )
              }
              type="button"
            >
              <span>Đẩy lại DLQ báo cáo</span>
            </button>
          </div>
        </div>
      </div>

      <RecoveryTable
        empty="Không có báo cáo nào bị lỗi."
        items={reports.data ?? []}
        loading={reports.isLoading}
        title="Báo cáo lỗi"
      >
        {(item) => (
          <tr key={item.id}>
            <td className="code">{item.reportType}</td>
            <td>
              <span className="font-medium">{item.status}</span>
              <div className="text-xs text-[var(--color-text-muted)]">
                Lần thử {item.attemptCount}
              </div>
            </td>
            <td className="max-w-xs">{item.errorMessage ?? item.lastErrorCode ?? "Không rõ"}</td>
            <td className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">
              {formatDateTime(item.createdAt)}
            </td>
            <td>
              <div className="flex gap-2">
                <button
                  className="button-small-primary"
                  disabled={action.isPending || item.status !== "FAILED"}
                  onClick={() =>
                    askReason(
                      `/admin/recovery/reports/${item.id}/replay`,
                      "Thử lại báo cáo",
                      "Báo cáo sẽ được xếp lại vào hàng đợi để tạo lần nữa.",
                    )
                  }
                  type="button"
                >
                  Thử lại
                </button>
                <button
                  className="button-small-secondary"
                  disabled={action.isPending || item.status !== "FAILED"}
                  onClick={() =>
                    askReason(
                      `/admin/recovery/reports/${item.id}/discard`,
                      "Bỏ qua báo cáo lỗi",
                      "Báo cáo này sẽ được đánh dấu đã bỏ và không chạy lại.",
                    )
                  }
                  type="button"
                >
                  Bỏ qua
                </button>
              </div>
            </td>
          </tr>
        )}
      </RecoveryTable>

      <RecoveryTable
        empty="Không có lượt nhập kho nào bị lỗi."
        items={imports.data ?? []}
        loading={imports.isLoading}
        title="Nhập kho lỗi"
      >
        {(item) => (
          <tr key={item.id}>
            <td className="code">{item.importJobId.slice(0, 8)}…</td>
            <td>
              <span className="font-medium">{item.terminalStatus}</span>
              <div className="text-xs text-[var(--color-text-muted)]">
                {item.status}, đã thử lại {item.replayCount}/{MAX_IMPORT_REPLAYS}
              </div>
            </td>
            <td className="max-w-xs">{item.errorMessage ?? item.errorCode ?? "Không rõ"}</td>
            <td className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">
              {formatDateTime(item.createdAt)}
            </td>
            <td>
              <div className="flex gap-2">
                <button
                  className="button-small-primary"
                  disabled={action.isPending || item.status !== "OPEN"}
                  onClick={() =>
                    askReason(
                      `/admin/recovery/imports/${item.id}/replay`,
                      "Thử lại lượt nhập kho",
                      "Lượt nhập kho sẽ chạy lại từ bước bị lỗi.",
                    )
                  }
                  type="button"
                >
                  Thử lại
                </button>
                <button
                  className="button-small-secondary"
                  disabled={action.isPending || item.status !== "OPEN"}
                  onClick={() =>
                    askReason(
                      `/admin/recovery/imports/${item.id}/discard`,
                      "Bỏ qua lượt nhập kho lỗi",
                      "Lượt nhập kho này sẽ được đánh dấu đã bỏ và không chạy lại.",
                    )
                  }
                  type="button"
                >
                  Bỏ qua
                </button>
              </div>
            </td>
          </tr>
        )}
      </RecoveryTable>

      {pendingAction ? (
        <ReasonDialog
          confirmLabel="Xác nhận"
          description={pendingAction.description}
          onCancel={() => setPendingAction(null)}
          onConfirm={(reason) => {
            action.mutate({ path: pendingAction.path, reason });
            setPendingAction(null);
          }}
          title={pendingAction.title}
        />
      ) : null}
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
      className={`rounded-md border px-3 py-2 ${
        danger && value > 0
          ? "border-rose-700/25 bg-rose-700/10 text-rose-800 dark:text-rose-300"
          : "border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]"
      }`}
    >
      <p className="m-0 text-xs text-[var(--color-text-muted)]">{label}</p>
      <strong className="font-display text-xl tabular-nums">{value}</strong>
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
      <div className="flex items-center justify-between border-b border-[var(--color-table-border)] px-5 py-4">
        <h3 className="m-0 font-display text-base font-semibold tracking-tight">{title}</h3>
        <span className="font-mono text-xs text-[var(--color-text-muted)]">{items.length} mục</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Đối tượng</th>
              <th>Trạng thái</th>
              <th>Lỗi</th>
              <th>Tạo lúc</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <TableState colSpan={5} text="Đang tải…" /> : null}
            {!loading && items.length === 0 ? <TableState colSpan={5} text={empty} /> : null}
            {!loading ? items.map(children) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
