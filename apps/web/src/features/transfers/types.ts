import type { TransferStatus } from "@stockflow/shared";
import type { BranchRef } from "@/features/branches/types";

export type TransferUser = {
  id: string;
  fullName: string | null;
  role: string;
  branch: BranchRef | null;
};

export type Transfer = {
  id: string;
  status: TransferStatus;
  note: string | null;
  rejectReason: string | null;
  createdAt: string;
  fromBranch: BranchRef;
  toBranch: BranchRef;
  items: Array<{
    id: string;
    quantity: number;
    component: {
      sku: string;
      name: string;
    };
  }>;
  requestedByUser?: TransferUser | null;
  approvedByUser?: TransferUser | null;
  rejectedByUser?: TransferUser | null;
};
