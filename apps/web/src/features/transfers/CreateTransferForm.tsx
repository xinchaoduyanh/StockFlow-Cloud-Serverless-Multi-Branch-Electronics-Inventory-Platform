"use client";

import type { Branch } from "@stockflow/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Notice } from "@/components/Notice";
import type { InventoryItem } from "@/features/inventory/types";
import { StockPicker } from "@/features/inventory/StockPicker";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import type { Transfer } from "./types";

const EMPTY_FORM = {
  fromBranchId: "",
  toBranchId: "",
  componentId: "",
  quantity: "1",
  note: "",
};

type CreateTransferFormProps = {
  branches: Branch[];
};

export function CreateTransferForm({ branches }: CreateTransferFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const [selectedStock, setSelectedStock] = useState<InventoryItem | null>(null);

  const createTransfer = useMutation({
    mutationFn: () =>
      apiRequest<Transfer>("/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromBranchId: form.fromBranchId,
          toBranchId: form.toBranchId,
          note: form.note || undefined,
          items: [{ componentId: form.componentId, quantity: Number(form.quantity) }],
        }),
      }),
    onSuccess: () => {
      setForm((current) => ({ ...current, componentId: "", quantity: "1", note: "" }));
      setSelectedStock(null);
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  function updateField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  // Stock belongs to the sending branch, so a different branch invalidates the chosen part.
  function changeFromBranch(branchId: string) {
    setForm((current) => ({ ...current, fromBranchId: branchId, componentId: "" }));
    setSelectedStock(null);
  }

  function selectStock(item: InventoryItem | null) {
    setSelectedStock(item);
    updateField("componentId", item?.componentId ?? "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTransfer.mutate();
  }

  return (
    <form className="surface grid h-fit gap-5 p-5" onSubmit={handleSubmit}>
      <div className="grid gap-1">
        <p className="m-0 text-xs text-[var(--color-text-muted)]">Yêu cầu chuyển kho</p>
        <h2 className="m-0 font-display text-lg font-semibold tracking-tight">Tạo yêu cầu</h2>
      </div>

      <label className="field">
        <span>Chi nhánh gửi</span>
        <select
          className="input"
          onChange={(event) => changeFromBranch(event.target.value)}
          required
          value={form.fromBranchId}
        >
          <option value="">Chọn chi nhánh gửi</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} · {branch.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Chi nhánh nhận</span>
        <select
          className="input"
          onChange={(event) => updateField("toBranchId", event.target.value)}
          required
          value={form.toBranchId}
        >
          <option value="">Chọn chi nhánh nhận</option>
          {branches
            .filter((branch) => branch.id !== form.fromBranchId)
            .map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
        </select>
      </label>

      <div className="field">
        <span>Linh kiện</span>
        <StockPicker branchId={form.fromBranchId} onChange={selectStock} value={selectedStock} />
      </div>

      <label className="field">
        <span>Số lượng</span>
        <input
          className="input font-mono"
          min="1"
          onChange={(event) => updateField("quantity", event.target.value)}
          required
          type="number"
          value={form.quantity}
        />
      </label>

      <label className="field">
        <span>Ghi chú</span>
        <textarea
          className="input min-h-20 py-2.5"
          onChange={(event) => updateField("note", event.target.value)}
          value={form.note}
        />
      </label>

      {createTransfer.error ? (
        <Notice tone="error">{errorMessage(createTransfer.error)}</Notice>
      ) : null}

      <button
        className="button-primary"
        disabled={createTransfer.isPending || !form.componentId}
        type="submit"
      >
        {createTransfer.isPending ? "Đang tạo…" : "Tạo yêu cầu"}
      </button>
    </form>
  );
}
