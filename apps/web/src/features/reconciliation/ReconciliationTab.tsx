import { ReconciliationIssue, ReconciliationStatus } from "@stockflow/shared";
import { Pagination } from "@/components/table/Pagination";
import { StatusBadge } from "@/components/table/StatusBadge";
import { TableHeader, TableState } from "@/components/table/TablePieces";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";

export function ReconciliationTab({
  issues,
  total,
  isLoading,
  onRun,
  onResolve,
  isRunning,
  statusFilter,
  onStatusFilterChange,
  currentPage,
  onPageChange,
}: {
  issues: ReconciliationIssue[];
  total: number;
  isLoading: boolean;
  onRun: () => void;
  onResolve: (id: string) => void;
  isRunning: boolean;
  statusFilter: ReconciliationStatus | "";
  onStatusFilterChange: (v: ReconciliationStatus | "") => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="grid gap-4 animate-rise-in-delay-1">
      <div className="surface p-5">
        <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
          <div>
            <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-950">
              Đối soát tồn kho
            </h2>
            <p className="m-0 mt-1.5 text-sm font-normal text-slate-500">
              So sánh số lượng tồn kho với sổ đăng ký biến động kho để phát hiện chênh lệch.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="input max-w-[160px] text-xs"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as ReconciliationStatus | "")}
            >
              <option value="">Tất cả trạng thái</option>
              <option value={ReconciliationStatus.OPEN}>Chưa đối soát</option>
              <option value={ReconciliationStatus.RESOLVED}>Đã đối soát</option>
              <option value={ReconciliationStatus.IGNORED}>Bỏ qua</option>
            </select>
            <button className="button-primary" onClick={onRun} disabled={isRunning} type="button">
              {isRunning ? "Đang chạy…" : "Chạy đối soát"}
            </button>
          </div>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <TableHeader title="Chênh lệch đối soát" count={total} />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Chi nhánh</th>
                <th>SKU</th>
                <th>Sản phẩm</th>
                <th>Sổ sách</th>
                <th>Thực tế</th>
                <th>Chênh lệch</th>
                <th>Trạng thái</th>
                <th>Phát hiện</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableState colSpan={9} text="Đang tải danh sách chênh lệch đối soát…" />
              ) : null}
              {!isLoading && issues.length === 0 ? (
                <TableState
                  colSpan={9}
                  text="Không phát hiện chênh lệch nào. Dữ liệu kho khớp hoàn toàn."
                />
              ) : null}
              {!isLoading &&
                issues.map((issue) => (
                  <tr key={issue.id}>
                    <td className="code">{issue.branch.code}</td>
                    <td className="code">{issue.component.sku}</td>
                    <td className="text-xs">{issue.component.name}</td>
                    <td className="font-mono tabular-nums">{issue.expectedQuantity}</td>
                    <td className="font-mono tabular-nums">{issue.actualQuantity}</td>
                    <td>
                      <span
                        className={`font-medium ${
                          issue.difference > 0
                            ? "text-emerald-700"
                            : issue.difference < 0
                              ? "text-rose-700"
                              : "text-slate-500"
                        }`}
                      >
                        {issue.difference > 0 ? "+" : ""}
                        {issue.difference}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="text-xs font-normal text-slate-500">
                      {new Date(issue.detectedAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      {issue.status === ReconciliationStatus.OPEN ? (
                        <button
                          className="button-small-primary"
                          onClick={() => onResolve(issue.id)}
                          type="button"
                        >
                          Giải quyết
                        </button>
                      ) : (
                        <span className="text-xs text-muted">
                          {issue.resolvedAt
                            ? new Date(issue.resolvedAt).toLocaleDateString("vi-VN")
                            : "-"}
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
          totalPages={Math.ceil(total / TABLE_PAGE_SIZE)}
          onPageChange={onPageChange}
          totalItems={total}
          pageSize={TABLE_PAGE_SIZE}
        />
      </div>
    </section>
  );
}
