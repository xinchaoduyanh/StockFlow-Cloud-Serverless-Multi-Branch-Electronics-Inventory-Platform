"use client";

import { DragEvent, FormEvent, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Notice } from "@/components/Notice";

type BranchOption = { id: string; code: string; name: string };

type UploadImportDialogProps = {
  branches: BranchOption[];
  branchId: string;
  onBranchChange: (branchId: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  progress: number | null;
  stage: "uploading" | "validating" | null;
  isPending: boolean;
  error: Error | null;
  onSubmit: () => void;
  onClose: () => void;
};

const STAGE_LABELS = {
  uploading: "Đang tải lên S3…",
  validating: "Đang xác thực dữ liệu…",
} as const;

function isExcelFile(file: File) {
  return file.name.toLowerCase().endsWith(".xlsx");
}

export function UploadImportDialog({
  branches,
  branchId,
  onBranchChange,
  file,
  onFileChange,
  progress,
  stage,
  isPending,
  error,
  onSubmit,
  onClose,
}: UploadImportDialogProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped && isExcelFile(dropped)) onFileChange(dropped);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Modal
      description="Chọn chi nhánh nhận hàng và tệp Excel. Hệ thống sẽ kiểm tra từng dòng trước khi bạn xác nhận."
      onClose={onClose}
      title="Nhập kho từ tệp Excel"
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <label className="field">
          <span>Chi nhánh nhận hàng</span>
          <select
            className="input"
            onChange={(event) => onBranchChange(event.target.value)}
            required
            value={branchId}
          >
            <option value="">Chọn chi nhánh</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>Bảng tính Excel (.xlsx)</span>
          <input
            accept=".xlsx"
            className="hidden"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            ref={fileInputRef}
            type="file"
          />
          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-input-border)] bg-[var(--color-input-bg)] p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]">
                  <Icon className="h-[18px] w-[18px]" name="file" />
                </span>
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-medium">{file.name}</p>
                  <p className="m-0 font-mono text-xs text-[var(--color-text-muted)]">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                aria-label="Bỏ tệp đã chọn"
                className="icon-button h-8 w-8 hover:text-rose-700"
                onClick={() => onFileChange(null)}
                type="button"
              >
                <Icon className="h-4 w-4" name="close" />
              </button>
            </div>
          ) : (
            <div
              className={`grid cursor-pointer justify-items-center gap-1.5 rounded-md border border-dashed p-7 text-center transition-colors duration-150 ${
                isDragOver
                  ? "border-[var(--color-accent-solid)] bg-indigo-600/10"
                  : "border-[var(--color-input-border)] bg-[var(--color-bg-muted)]/50 hover:border-[var(--color-accent-solid)]"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragLeave={() => setIsDragOver(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDrop={handleDrop}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <Icon className="h-7 w-7 text-[var(--color-accent-solid)]" name="cloudUpload" />
              <p className="m-0 text-sm font-medium">Kéo thả bảng tính vào đây</p>
              <p className="m-0 text-xs text-[var(--color-text-muted)]">
                hoặc <span className="underline underline-offset-4">chọn tệp từ máy tính</span>
              </p>
            </div>
          )}
        </div>

        {progress !== null ? (
          <div className="grid gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]/60 p-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{stage ? STAGE_LABELS[stage] : "Đang xử lý…"}</span>
              <span className="font-mono text-xs">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent-solid)] transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {error ? <Notice tone="error">{error.message || "Yêu cầu thất bại"}</Notice> : null}

        <button
          className="button-primary w-full"
          disabled={isPending || !file || !branchId}
          type="submit"
        >
          {isPending ? "Đang xử lý nhập kho…" : "Bắt đầu nhập kho"}
        </button>
      </form>
    </Modal>
  );
}
