import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Paginated } from "@stockflow/shared";
import { apiRequest } from "@/lib/api-client";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import type { Transfer } from "./types";

type TransferFilters = {
  branchId?: string;
  status?: Transfer["status"];
  page?: number;
  limit?: number;
};

export function useTransfers({
  branchId,
  status,
  page = 1,
  limit = TABLE_PAGE_SIZE,
}: TransferFilters = {}) {
  return useQuery({
    queryKey: ["transfers", branchId ?? "", status ?? "", page, limit],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (branchId) params.set("branchId", branchId);
      if (status) params.set("status", status);
      return apiRequest<Paginated<Transfer>>(`/transfers?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}
