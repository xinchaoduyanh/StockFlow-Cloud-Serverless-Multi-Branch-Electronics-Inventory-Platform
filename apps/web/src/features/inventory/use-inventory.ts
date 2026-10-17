import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { InventorySummary, Paginated } from "@stockflow/shared";
import { apiRequest } from "@/lib/api-client";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import type { InventoryItem } from "./types";

type InventoryFilters = {
  search?: string;
  category?: string;
  branchId?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
};

function buildParams({
  search,
  category,
  branchId,
  page = 1,
  limit = TABLE_PAGE_SIZE,
}: InventoryFilters) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (branchId) params.set("branchId", branchId);
  return params;
}

export function useInventory(filters: InventoryFilters = {}) {
  const { search, category, branchId, page = 1, limit = TABLE_PAGE_SIZE, enabled = true } = filters;

  return useQuery({
    queryKey: ["inventory", "list", search ?? "", category ?? "", branchId ?? "", page, limit],
    queryFn: () =>
      apiRequest<Paginated<InventoryItem>>(`/inventory?${buildParams(filters).toString()}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLowStock({
  branchId,
  search,
  category,
  page = 1,
  enabled = true,
}: Pick<InventoryFilters, "branchId" | "search" | "category" | "page" | "enabled">) {
  return useQuery({
    queryKey: ["inventory", "low-stock", search ?? "", category ?? "", branchId ?? "", page],
    queryFn: () => {
      const params = buildParams({ branchId, search, category, page });
      params.set("lowStock", "true");
      return apiRequest<Paginated<InventoryItem>>(`/inventory?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Unit totals and the low-stock count across all rows of the branch, not one page. */
export function useInventorySummary(branchId?: string) {
  return useQuery({
    queryKey: ["inventory", "summary", branchId ?? ""],
    queryFn: () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      return apiRequest<InventorySummary>(`/inventory/summary?${params.toString()}`);
    },
  });
}
