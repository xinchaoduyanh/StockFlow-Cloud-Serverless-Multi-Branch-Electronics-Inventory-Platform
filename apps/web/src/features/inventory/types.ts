import type { ComponentCategory } from "@stockflow/shared";
import type { BranchRef } from "@/features/branches/types";

export type InventoryItem = {
  branchId: string;
  componentId: string;
  quantity: number;
  reservedQuantity: number;
  minStockThreshold: number;
  branch: BranchRef;
  component: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    category: ComponentCategory;
  };
};
