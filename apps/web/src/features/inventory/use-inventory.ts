import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import type { InventoryItem } from "./types";

type InventoryFilters = {
  search?: string;
  category?: string;
  branchId?: string;
};

export function useInventory({ search, category, branchId }: InventoryFilters = {}) {
  return useQuery({
    queryKey: ["inventory", search ?? "", category ?? "", branchId ?? ""],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (branchId) params.set("branchId", branchId);
      return apiRequest<InventoryItem[]>(`/inventory?${params.toString()}`);
    },
  });
}

export function useLowStock(branchId?: string) {
  return useQuery({
    queryKey: ["inventory", "low-stock", branchId ?? ""],
    queryFn: () => {
      const params = new URLSearchParams({ lowStock: "true" });
      if (branchId) params.set("branchId", branchId);
      return apiRequest<InventoryItem[]>(`/inventory?${params.toString()}`);
    },
  });
}
