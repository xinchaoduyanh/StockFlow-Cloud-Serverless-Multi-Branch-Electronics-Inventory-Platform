"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/Modal";

type ReasonDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  /** Used when the user leaves the reason empty. Without it, a reason is required. */
  defaultReason?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function ReasonDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Hủy",
  isDestructive = false,
  defaultReason,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();
  const isRequired = defaultReason === undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm(trimmedReason || defaultReason || "");
  }

  return (
    <Modal description={description} onClose={onCancel} title={title}>
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <label className="field">
          <span>Lý do</span>
          <textarea
            autoFocus
            className="input min-h-24 py-2.5"
            onChange={(event) => setReason(event.target.value)}
            placeholder={defaultReason ?? "Ghi ngắn gọn để người sau còn tra cứu được"}
            required={isRequired}
            value={reason}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button className="button-secondary" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button
            className={isDestructive ? "button-danger" : "button-primary"}
            disabled={isRequired && !trimmedReason}
            type="submit"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
