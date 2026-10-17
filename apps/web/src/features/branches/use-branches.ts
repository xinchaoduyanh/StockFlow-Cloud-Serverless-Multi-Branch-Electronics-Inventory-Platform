import { useQuery } from "@tanstack/react-query";
import type { Branch } from "@stockflow/shared";
import { apiRequest } from "@/lib/api-client";

export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: () => apiRequest<Branch[]>("/branches"),
  });
}
