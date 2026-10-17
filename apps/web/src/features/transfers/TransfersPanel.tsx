"use client";

import type { Branch } from "@stockflow/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useInventory } from "@/features/inventory/use-inventory";
import { apiRequest } from "@/lib/api-client";
import { CreateTransferForm } from "./CreateTransferForm";
import { TransferList } from "./TransferList";
import { useTransfers } from "./use-transfers";

type TransfersPanelProps = {
  isAdmin: boolean;
  branches: Branch[];
  selectedBranchId: string;
};

export function TransfersPanel({ isAdmin, branches, selectedBranchId }: TransfersPanelProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const transfersQuery = useTransfers(selectedBranchId);
  const inventoryQuery = useInventory({ branchId: selectedBranchId });

  function refreshStock() {
    void queryClient.invalidateQueries({ queryKey: ["transfers"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  }

  const approveTransfer = useMutation({
    mutationFn: (id: string) => apiRequest(`/transfers/${id}/approve`, { method: "POST" }),
    onSuccess: refreshStock,
  });

  const rejectTransfer = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`/transfers/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: refreshStock,
  });

  return (
    <section className="grid gap-5 lg:grid-cols-[340px_1fr] animate-rise-in-delay-1">
      <CreateTransferForm branches={branches} inventoryItems={inventoryQuery.data ?? []} />

      <div className="flex min-w-0 flex-col gap-4">
        <TransferList
          currentPage={page}
          isAdmin={isAdmin}
          isLoading={transfersQuery.isLoading}
          items={transfersQuery.data ?? []}
          onApprove={(id) => approveTransfer.mutate(id)}
          onPageChange={setPage}
          onReject={(id, reason) => rejectTransfer.mutate({ id, reason })}
        />
      </div>
    </section>
  );
}
