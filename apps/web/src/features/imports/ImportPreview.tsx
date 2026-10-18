import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/table/Pagination";
import { StatusBadge } from "@/components/table/StatusBadge";
import { TableState } from "@/components/table/TablePieces";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import type { ImportJob, ImportPreviewRow } from "./types";

export function ImportPreviewModal({
  job,
  onClose,
  children,
}: {
  job: ImportJob | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      description="Xem trước nhập kho"
      onClose={onClose}
      title={job?.fileName ?? "Xem trước bảng tính"}
      widthClassName="max-w-[1120px]"
    >
      {children}
    </Modal>
  );
}

export function ImportPreview({
  rows,
  total,
  summary,
  isLoading,
  canConfirm,
  isConfirming,
  onConfirm,
  currentPage,
  onPageChange,
}: {
  /** Rows of the current page only. */
  rows: ImportPreviewRow[];
  total: number;
  /** Row counts of the whole job, not just the page on screen. */
  summary: { totalRows: number; validRows: number; invalidRows: number };
  isLoading: boolean;
  canConfirm: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200/60 bg-[var(--color-bg-surface)]">
      {/* Spacious Widescreen Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 bg-slate-50 p-4 max-md:flex-col max-md:items-start">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950">
            <Icon name="file" className="h-5 w-5 text-slate-500" />
            Chi tiết nhập kho & Không gian kiểm tra
          </h2>
          <p className="mt-0.5 text-xs font-normal text-slate-500">
            Kiểm tra cấu trúc bảng tính trước khi lưu chính thức
          </p>
        </div>

        {total > 0 ? (
          canConfirm ? (
            <button
              className="button-primary px-5 py-2.5"
              disabled={summary.validRows === 0 || isConfirming}
              onClick={onConfirm}
              type="button"
            >
              {isConfirming ? "Đang xác nhận…" : "Xác nhận nhập kho"}
            </button>
          ) : (
            <span className="flex items-center gap-2 rounded-md border border-slate-200/70 bg-[var(--color-bg-surface)] px-4 py-2 text-xs font-medium text-slate-700">
              <Icon name="check" className="h-4 w-4" />
              Đã nhập & Đồng bộ
            </span>
          )
        ) : null}
      </div>

      {total > 0 ? (
        /* Spacious Stats Cards Section */
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200/60 bg-slate-50 p-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-[var(--color-bg-surface)] p-4">
            <div>
              <span className="text-xs font-medium r text-slate-500">Tổng số dòng đã nạp</span>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{summary.totalRows}</p>
            </div>
            <div className="rounded-md bg-slate-100 p-2 text-slate-600">
              <Icon name="list" className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-emerald-100/70 bg-[var(--color-bg-surface)] p-4">
            <div>
              <span className="text-xs font-medium r text-emerald-700">Dòng hợp lệ</span>
              <p className="mt-1 text-2xl font-semibold text-emerald-800">{summary.validRows}</p>
            </div>
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
              <Icon name="checkCircle" className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-rose-100/70 bg-[var(--color-bg-surface)] p-4">
            <div>
              <span className="text-xs font-medium r text-rose-700">Dòng lỗi / Không hợp lệ</span>
              <p className="mt-1 text-2xl font-semibold text-rose-800">{summary.invalidRows}</p>
            </div>
            <div className="rounded-md bg-rose-50 p-2 text-rose-700">
              <Icon name="alert" className="h-5 w-5" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-20">Dòng</th>
              <th className="w-40">SKU</th>
              <th>Tên / Chi tiết</th>
              <th className="w-32">Trạng thái</th>
              <th>Lỗi kiểm tra / Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={5} text="Đang tải bản xem trước…" /> : null}
            {!isLoading && total === 0 ? (
              <TableState
                colSpan={5}
                text="Chọn một phiên nhập kho để hiển thị nhật ký kiểm tra."
              />
            ) : null}
            {!isLoading &&
              rows.map((row) => (
                <tr key={row.id} className="transition-colors duration-150 hover:bg-slate-50/70">
                  <td className="font-normal text-slate-500">{row.rowNumber}</td>
                  <td className="font-medium text-slate-800">{row.sku ?? "-"}</td>
                  <td className="font-normal text-slate-700">
                    {String(row.normalizedData?.name ?? "-")}
                  </td>
                  <td>
                    <StatusBadge status={row.validationStatus} />
                  </td>
                  <td className="max-w-[450px] whitespace-normal text-xs font-normal leading-relaxed text-rose-700">
                    {row.errorMessage ? (
                      <span className="flex items-center gap-1.5">
                        <Icon name="alert" className="h-4 w-4 shrink-0 text-rose-500" />
                        {row.errorMessage}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-500" />
                        Sẵn sàng lưu trữ
                      </span>
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
        totalItems={total}
        pageSize={TABLE_PAGE_SIZE}
      />
    </section>
  );
}
