import { Pagination } from "@/components/table/Pagination";
import { TableHeader, TableState } from "@/components/table/TablePieces";
import type { InventoryItem } from "./types";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";

export function InventoryTable({
  items,
  total,
  isLoading,
  currentPage,
  onPageChange,
}: {
  items: InventoryItem[];
  total: number;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Danh sách tồn kho" count={total} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Chi nhánh</th>
              <th>Số lượng</th>
              <th>Tạm giữ</th>
              <th>Mức tối thiểu</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={7} text="Đang tải dữ liệu tồn kho…" /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={7} text="Không tìm thấy dữ liệu tồn kho." />
            ) : null}
            {!isLoading &&
              items.map((item) => (
                <tr key={`${item.branchId}-${item.componentId}`}>
                  <td className="code">{item.component.sku}</td>
                  <td>{item.component.name}</td>
                  <td>{item.component.category}</td>
                  <td>
                    <span className="chip">{item.branch.code}</span>
                  </td>
                  <td
                    className={`font-mono tabular-nums ${item.quantity <= item.minStockThreshold ? "font-semibold text-rose-700 dark:text-rose-300" : ""}`}
                  >
                    {item.quantity}
                  </td>
                  <td className="font-mono tabular-nums">{item.reservedQuantity}</td>
                  <td className="font-mono tabular-nums">{item.minStockThreshold}</td>
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
    </section>
  );
}

export function LowStockReport({
  items,
  total,
  isLoading,
  currentPage,
  onPageChange,
}: {
  items: InventoryItem[];
  total: number;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Báo cáo tồn kho thấp" count={total} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Tên sản phẩm</th>
              <th>Chi nhánh</th>
              <th>Số lượng</th>
              <th>Đang giữ</th>
              <th>Mức tối thiểu</th>
              <th>Thiếu hụt</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={7} text="Đang tải dữ liệu tồn thấp…" /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={7} text="Không có sản phẩm nào dưới mức tối thiểu." />
            ) : null}
            {!isLoading &&
              items.map((item) => (
                <tr key={`${item.branchId}-${item.componentId}`}>
                  <td className="code">{item.component.sku}</td>
                  <td>{item.component.name}</td>
                  <td>
                    <span className="chip">{item.branch.code}</span>
                  </td>
                  <td
                    className={`font-mono tabular-nums ${item.quantity <= item.minStockThreshold ? "font-semibold text-rose-700 dark:text-rose-300" : ""}`}
                  >
                    {item.quantity}
                  </td>
                  <td className="font-mono tabular-nums">{item.reservedQuantity}</td>
                  <td className="font-mono tabular-nums">{item.minStockThreshold}</td>
                  <td className="font-medium text-red-700 dark:text-red-400">
                    {Math.max(item.minStockThreshold - (item.quantity - item.reservedQuantity), 0)}
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
    </section>
  );
}
