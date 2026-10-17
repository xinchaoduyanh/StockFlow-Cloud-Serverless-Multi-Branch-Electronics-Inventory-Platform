"use client";

import { COMPONENT_CATEGORIES, TransferStatus } from "@stockflow/shared";
import type { Branch } from "@stockflow/shared";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/features/dashboard/StatCard";
import { useTransfers } from "@/features/transfers/use-transfers";
import { InventoryTable, LowStockReport } from "./InventoryTables";
import { useInventory, useInventorySummary, useLowStock } from "./use-inventory";

type InventoryPanelProps = {
  mode: "inventory" | "low-stock";
  branches: Branch[];
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
};

function formatCount(value: number) {
  return value.toLocaleString("vi-VN");
}

export function InventoryPanel({
  mode,
  branches,
  selectedBranchId,
  onBranchChange,
}: InventoryPanelProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);

  const isInventoryMode = mode === "inventory";
  const filters = { search, category, branchId: selectedBranchId };
  const inventoryQuery = useInventory({
    ...filters,
    page: inventoryPage,
    enabled: isInventoryMode,
  });
  const lowStockQuery = useLowStock({ ...filters, page: lowStockPage, enabled: !isInventoryMode });
  const summaryQuery = useInventorySummary(selectedBranchId);
  const pendingTransfersQuery = useTransfers({
    branchId: selectedBranchId,
    status: TransferStatus.PENDING,
    limit: 1,
  });

  useEffect(() => {
    setInventoryPage(1);
    setLowStockPage(1);
  }, [search, category, selectedBranchId]);

  const summary = useMemo(() => {
    const totalUnits = summaryQuery.data?.totalUnits ?? 0;
    const reservedUnits = summaryQuery.data?.reservedUnits ?? 0;
    const lowStockCount = summaryQuery.data?.lowStockCount ?? 0;
    const pendingTransfers = pendingTransfersQuery.data?.total ?? 0;

    return [
      {
        label: "Tổng số lượng",
        value: formatCount(totalUnits),
        caption: "Cộng dồn trên các chi nhánh đang xem",
        icon: "package",
        tone: "neutral",
      },
      {
        label: "Đang tạm giữ",
        value: formatCount(reservedUnits),
        caption: "Đã giữ cho yêu cầu chuyển kho",
        icon: "lock",
        tone: "accent",
      },
      {
        label: "Tồn thấp",
        value: formatCount(lowStockCount),
        caption: "Mặt hàng đã chạm mức tối thiểu",
        icon: "alert",
        tone: lowStockCount > 0 ? "danger" : "neutral",
      },
      {
        label: "Chờ duyệt",
        value: formatCount(pendingTransfers),
        caption: "Yêu cầu chuyển kho chưa xử lý",
        icon: "transfer",
        tone: pendingTransfers > 0 ? "accent" : "neutral",
      },
    ] as const;
  }, [summaryQuery.data, pendingTransfersQuery.data]);

  return (
    <>
      {mode === "inventory" ? (
        <section
          aria-label="Tổng quan tồn kho"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-rise-in"
        >
          {summary.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </section>
      ) : null}

      <section className="surface grid grid-cols-[1fr_220px_280px] gap-4 p-4 max-md:grid-cols-1 animate-rise-in-delay-1">
        <label className="field">
          <span>Tìm theo SKU hoặc tên</span>
          <input
            className="input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nhập mã SKU hoặc tên…"
            value={search}
          />
        </label>
        <label className="field">
          <span>Danh mục</span>
          <select
            className="input"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="">Tất cả danh mục</option>
            {COMPONENT_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Chi nhánh</span>
          <select
            className="input"
            onChange={(event) => onBranchChange(event.target.value)}
            value={selectedBranchId}
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {mode === "inventory" ? (
        <InventoryTable
          currentPage={inventoryPage}
          isLoading={inventoryQuery.isLoading}
          items={inventoryQuery.data?.items ?? []}
          onPageChange={setInventoryPage}
          total={inventoryQuery.data?.total ?? 0}
        />
      ) : (
        <LowStockReport
          currentPage={lowStockPage}
          isLoading={lowStockQuery.isLoading}
          items={lowStockQuery.data?.items ?? []}
          onPageChange={setLowStockPage}
          total={lowStockQuery.data?.total ?? 0}
        />
      )}
    </>
  );
}
