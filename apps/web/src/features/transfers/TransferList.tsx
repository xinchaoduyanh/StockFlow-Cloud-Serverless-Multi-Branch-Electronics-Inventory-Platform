"use client";

import { TransferStatus } from "@stockflow/shared";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Pagination } from "@/components/table/Pagination";
import { StatusBadge } from "@/components/table/StatusBadge";
import { TableHeader, TableState } from "@/components/table/TablePieces";
import { USER_ROLE_LABELS } from "@/features/auth/role-labels";
import { RejectTransferDialog } from "./RejectTransferDialog";
import type { Transfer, TransferUser } from "./types";

export function TransferList({
  items,
  isLoading,
  isAdmin,
  onApprove,
  onReject,
  currentPage,
  onPageChange,
}: {
  items: Transfer[];
  isLoading: boolean;
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const pageSize = 8;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function renderUserBadge(user?: TransferUser | null) {
    if (!user) return <span className="text-slate-400">-</span>;
    const branchText = user.branch ? ` · ${user.branch.code}` : "";
    return (
      <div className="flex flex-col whitespace-nowrap text-left">
        <span className="text-sm font-medium text-slate-800">{user.fullName || "Ẩn danh"}</span>
        <span className="text-xs text-slate-500">
          {USER_ROLE_LABELS[user.role] ?? user.role}
          {branchText}
        </span>
      </div>
    );
  }

  function formatDate(dateString: string) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  }

  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Yêu cầu chuyển kho" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Trạng thái</th>
              <th>Thời gian</th>
              <th>Lộ trình</th>
              <th>Sản phẩm</th>
              <th>Người yêu cầu</th>
              <th>Người phê duyệt</th>
              <th>Ghi chú / Lý do</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableState colSpan={8} text="Đang tải danh sách yêu cầu chuyển kho…" />
            ) : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={8} text="Không có yêu cầu chuyển kho nào." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="chip">{item.fromBranch.code}</span>
                    <Icon
                      name="chevronRight"
                      className="mx-0.5 inline h-3.5 w-3.5 text-slate-400"
                    />
                    <span className="chip">{item.toBranch.code}</span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      {item.items.map((line) => (
                        <div key={line.id} className="whitespace-nowrap">
                          <span className="code">{line.component.sku}</span>
                          <span className="ml-1.5 font-mono text-xs text-slate-500">
                            × {line.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>{renderUserBadge(item.requestedByUser)}</td>
                  <td>
                    {item.status === TransferStatus.COMPLETED ? (
                      renderUserBadge(item.approvedByUser)
                    ) : item.status === TransferStatus.REJECTED ? (
                      renderUserBadge(item.rejectedByUser)
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td
                    className="max-w-[200px] truncate text-xs text-slate-600"
                    title={item.rejectReason ?? item.note ?? ""}
                  >
                    {item.rejectReason ?? item.note ?? "-"}
                  </td>
                  <td>
                    {isAdmin && item.status === TransferStatus.PENDING ? (
                      <div className="flex gap-2">
                        <button
                          className="button-small-primary"
                          onClick={() => onApprove(item.id)}
                          type="button"
                        >
                          Duyệt
                        </button>
                        <button
                          className="button-small-secondary"
                          onClick={() => setRejectingId(item.id)}
                          type="button"
                        >
                          Từ chối
                        </button>
                      </div>
                    ) : (
                      "-"
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
        totalItems={items.length}
        pageSize={pageSize}
      />
      {rejectingId ? (
        <RejectTransferDialog
          onCancel={() => setRejectingId(null)}
          onConfirm={(reason) => {
            onReject(rejectingId, reason);
            setRejectingId(null);
          }}
        />
      ) : null}
    </section>
  );
}
