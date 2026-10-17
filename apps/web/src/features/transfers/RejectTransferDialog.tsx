"use client";

import { ReasonDialog } from "@/components/ReasonDialog";

const DEFAULT_REJECT_REASON = "Không được duyệt";

type RejectTransferDialogProps = {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function RejectTransferDialog({ onConfirm, onCancel }: RejectTransferDialogProps) {
  return (
    <ReasonDialog
      cancelLabel="Giữ yêu cầu"
      confirmLabel="Từ chối yêu cầu"
      defaultReason={DEFAULT_REJECT_REASON}
      description="Lý do sẽ được lưu cùng yêu cầu chuyển kho này."
      isDestructive
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Từ chối yêu cầu chuyển kho"
    />
  );
}
