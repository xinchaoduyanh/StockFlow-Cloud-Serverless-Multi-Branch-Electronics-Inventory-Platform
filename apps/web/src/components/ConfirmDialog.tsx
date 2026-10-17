"use client";

import { Modal } from "@/components/Modal";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal description={description} onClose={onCancel} title={title}>
      <div className="flex justify-end gap-2">
        <button className="button-secondary" onClick={onCancel} type="button">
          Hủy
        </button>
        <button
          className={isDestructive ? "button-danger" : "button-primary"}
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
