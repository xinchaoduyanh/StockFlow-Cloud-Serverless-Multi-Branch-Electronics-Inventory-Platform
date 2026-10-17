import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import type { Transfer } from "./types";

export function useTransfers(branchId?: string) {
  return useQuery({
    queryKey: ["transfers", branchId ?? ""],
    queryFn: () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      return apiRequest<Transfer[]>(`/transfers?${params.toString()}`);
    },
  });
}
