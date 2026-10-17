import { ExportJobStatus, ReportType } from "@stockflow/shared";
import { Icon } from "@/components/Icon";
import { Pagination } from "@/components/table/Pagination";
import { StatusBadge } from "@/components/table/StatusBadge";
import { TableHeader, TableState } from "@/components/table/TablePieces";
import type { ExportJob } from "./types";

const reportTypes = [
  { id: ReportType.INVENTORY, label: "Báo cáo tồn kho", icon: "package" },
  { id: ReportType.LOW_STOCK, label: "Cảnh báo tồn thấp", icon: "alert" },
  { id: ReportType.TRANSFERS, label: "Lịch sử chuyển kho", icon: "transfer" },
  { id: ReportType.IMPORT_HISTORY, label: "Lịch sử nhập kho", icon: "upload" },
  { id: ReportType.STOCK_MOVEMENTS, label: "Biến động kho", icon: "list" },
] as const;

export function ReportsTab({
  exports: exportJobs,
  isLoading,
  onCreateExport,
  isCreating,
  currentPage,
  onPageChange,
}: {
  exports: ExportJob[];
  isLoading: boolean;
  onCreateExport: (type: ReportType) => void;
  isCreating: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(exportJobs.length / pageSize);
  const paginatedItems = exportJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="grid gap-4 animate-rise-in-delay-1">
      <div className="surface p-5">
        <div className="mb-4">
          <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-950">
            Xuất báo cáo dữ liệu
          </h2>
          <p className="m-0 mt-1.5 text-sm font-normal text-slate-500">
            Tạo báo cáo CSV từ dữ liệu kho hàng và tải xuống trực tiếp từ S3.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {reportTypes.map((report) => (
            <button
              key={report.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-[var(--color-bg-surface)] p-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50 "
              onClick={() => onCreateExport(report.id)}
              disabled={isCreating}
              type="button"
            >
              <Icon
                name={report.icon}
                className="h-[18px] w-[18px] text-[var(--color-accent-solid)]"
              />
              <span className="text-xs font-medium text-slate-800">{report.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="surface overflow-hidden">
        <TableHeader title="Lịch sử xuất báo cáo" count={exportJobs.length} />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loại báo cáo</th>
                <th>Trạng thái</th>
                <th>Số dòng dữ liệu</th>
                <th>Tệp tin</th>
                <th>Thời gian tạo</th>
                <th>Tải xuống</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableState colSpan={6} text="Đang tải lịch sử xuất báo cáo…" /> : null}
              {!isLoading && exportJobs.length === 0 ? (
                <TableState
                  colSpan={6}
                  text="Chưa có báo cáo nào được xuất. Nhấp vào loại báo cáo ở trên để tạo."
                />
              ) : null}
              {!isLoading &&
                paginatedItems.map((job) => (
                  <tr key={job.id}>
                    <td className="font-medium text-slate-800">
                      {job.reportType === ReportType.INVENTORY
                        ? "Báo cáo tồn kho"
                        : job.reportType === ReportType.LOW_STOCK
                          ? "Cảnh báo tồn thấp"
                          : job.reportType === ReportType.TRANSFERS
                            ? "Lịch sử chuyển kho"
                            : job.reportType === ReportType.IMPORT_HISTORY
                              ? "Lịch sử nhập kho"
                              : "Biến động kho"}
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td>{job.totalRecords ?? "-"}</td>
                    <td className="text-xs font-normal text-slate-500">{job.fileName ?? "-"}</td>
                    <td className="text-xs font-normal text-slate-500">
                      {new Date(job.createdAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      {job.status === ExportJobStatus.COMPLETED ? (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/reports/export/${job.id}/download`}
                          className="button-small-primary no-underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Tải xuống
                        </a>
                      ) : job.status === ExportJobStatus.FAILED ? (
                        <span className="text-xs text-red-600" title={job.errorMessage ?? ""}>
                          Lỗi
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted">Đang xử lý…</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalItems={exportJobs.length}
          pageSize={pageSize}
        />
      </div>
    </section>
  );
}
