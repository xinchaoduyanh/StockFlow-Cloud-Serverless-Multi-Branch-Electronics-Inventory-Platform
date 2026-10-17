import { ImportStatus } from "@stockflow/shared";
import { Pagination } from "@/components/table/Pagination";
import { StatusBadge } from "@/components/table/StatusBadge";
import { TableHeader, TableState } from "@/components/table/TablePieces";
import type { ImportJob } from "./types";

export function ImportJobsTable({
  items,
  isLoading,
  selectedId,
  onSelect,
  currentPage,
  onPageChange,
}: {
  items: ImportJob[];
  isLoading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Danh sách nhập kho" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tệp tin</th>
              <th>Chi nhánh</th>
              <th>Thời gian tải lên</th>
              <th>Trạng thái</th>
              <th>Số dòng</th>
              <th>Xem chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={6} text="Đang tải danh sách nhập kho…" /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={6} text="Chưa có yêu cầu nhập kho nào." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => {
                const isProcessing =
                  item.status === ImportStatus.UPLOADED || item.status === ImportStatus.VALIDATING;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-medium text-slate-800">
                        {item.fileName ?? "Không tên"}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-500">Bảng tính Excel</div>
                    </td>
                    <td>
                      <span className="chip">{item.branch.code}</span>
                    </td>
                    <td className="text-xs font-normal text-slate-500">
                      {new Date(item.createdAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      {isProcessing ? (
                        <span className="text-xs italic text-muted">Đang xử lý…</span>
                      ) : (
                        `${item.validRows} hợp lệ / ${item.invalidRows} không hợp lệ`
                      )}
                    </td>
                    <td>
                      <button
                        className={
                          isProcessing
                            ? "button-small-secondary opacity-50 cursor-not-allowed"
                            : selectedId === item.id
                              ? "button-small-primary"
                              : "button-small-secondary"
                        }
                        onClick={() => !isProcessing && onSelect(item.id)}
                        type="button"
                        disabled={isProcessing}
                        title={
                          isProcessing
                            ? "Tệp tin đang được xử lý trên đám mây"
                            : "Nhấp để xem trước các dòng đã nạp"
                        }
                      >
                        {item.status === ImportStatus.VALIDATING ? "Đang phân tích…" : "Xem trước"}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={items.length}
        pageSize={pageSize}
      />
    </section>
  );
}
