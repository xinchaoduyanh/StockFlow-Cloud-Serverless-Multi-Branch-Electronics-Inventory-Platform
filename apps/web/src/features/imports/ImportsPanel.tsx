"use client";

import { ImportStatus } from "@stockflow/shared";
import type { Branch, Paginated } from "@stockflow/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { apiRequest } from "@/lib/api-client";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import { ImportJobsTable } from "./ImportJobsTable";
import { ImportPreview, ImportPreviewModal } from "./ImportPreview";
import type { ImportJob, ImportPreviewRow } from "./types";
import { UploadImportDialog } from "./UploadImportDialog";
import { useImportUpload } from "./use-import-upload";

const ACTIVE_JOB_POLL_MS = 1500;

type ImportsPanelProps = {
  branches: Branch[];
  selectedBranchId: string;
  defaultBranchId: string | null;
};

export function ImportsPanel({ branches, selectedBranchId, defaultBranchId }: ImportsPanelProps) {
  const queryClient = useQueryClient();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadBranchId, setUploadBranchId] = useState(defaultBranchId ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImportId, setSelectedImportId] = useState("");
  const [jobsPage, setJobsPage] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);

  useEffect(() => {
    if (defaultBranchId && !uploadBranchId) setUploadBranchId(defaultBranchId);
  }, [defaultBranchId, uploadBranchId]);

  const importsQuery = useQuery({
    queryKey: ["imports", "list", selectedBranchId, jobsPage],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(jobsPage),
        limit: String(TABLE_PAGE_SIZE),
      });
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      return apiRequest<Paginated<ImportJob>>(`/imports?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const hasActiveJobs = query.state.data?.items.some(
        (job) => job.status === ImportStatus.UPLOADED || job.status === ImportStatus.VALIDATING,
      );
      return hasActiveJobs ? ACTIVE_JOB_POLL_MS : false;
    },
  });

  const previewQuery = useQuery({
    queryKey: ["imports", selectedImportId, "preview", previewPage],
    queryFn: () =>
      apiRequest<Paginated<ImportPreviewRow>>(
        `/imports/${selectedImportId}/preview?page=${previewPage}&limit=${TABLE_PAGE_SIZE}`,
      ),
    placeholderData: keepPreviousData,
    enabled: Boolean(selectedImportId),
  });

  const confirmImport = useMutation({
    mutationFn: (id: string) => apiRequest(`/imports/${id}/confirm`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const uploader = useImportUpload(() => {
    setSelectedFile(null);
    setIsUploadOpen(false);
  });

  function closeUploadDialog() {
    setIsUploadOpen(false);
    setSelectedFile(null);
    uploader.reset();
  }

  const importJobs = importsQuery.data?.items ?? [];
  const selectedJob = useMemo(
    () => importJobs.find((job) => job.id === selectedImportId),
    [importJobs, selectedImportId],
  );

  function submitUpload() {
    if (!selectedFile || !uploadBranchId) return;
    uploader.upload({ branchId: uploadBranchId, file: selectedFile });
  }

  return (
    <section className="grid gap-5 animate-rise-in-delay-1">
      <div className="surface flex items-center justify-between gap-4 p-6 max-sm:flex-col max-sm:items-start">
        <div className="grid gap-1.5">
          <span className="chip w-fit font-sans">Nhập kho từ đám mây</span>
          <h2 className="m-0 font-display text-xl font-semibold tracking-tight">
            Nhập kho bằng bảng tính Excel
          </h2>
          <p className="m-0 text-sm text-[var(--color-text-secondary)]">
            Tải lên, kiểm tra, xem trước và lưu trữ tệp hàng tồn kho Excel.
          </p>
        </div>
        <button className="button-primary" onClick={() => setIsUploadOpen(true)} type="button">
          <Icon className="h-4 w-4" name="plus" />
          <span>Nhập bảng tính</span>
        </button>
      </div>

      {isUploadOpen ? (
        <UploadImportDialog
          branchId={uploadBranchId}
          branches={branches}
          error={uploader.error}
          file={selectedFile}
          isPending={uploader.isPending}
          onBranchChange={setUploadBranchId}
          onClose={closeUploadDialog}
          onFileChange={setSelectedFile}
          onSubmit={submitUpload}
          progress={uploader.progress}
          stage={uploader.stage}
        />
      ) : null}

      <ImportJobsTable
        currentPage={jobsPage}
        isLoading={importsQuery.isLoading}
        items={importJobs}
        total={importsQuery.data?.total ?? 0}
        onPageChange={setJobsPage}
        onSelect={(id) => {
          setPreviewPage(1);
          setSelectedImportId(id);
        }}
        selectedId={selectedImportId}
      />

      {selectedImportId ? (
        <ImportPreviewModal job={selectedJob} onClose={() => setSelectedImportId("")}>
          <ImportPreview
            canConfirm={selectedJob?.status === ImportStatus.PREVIEW_READY}
            currentPage={previewPage}
            isConfirming={confirmImport.isPending}
            isLoading={previewQuery.isLoading}
            onConfirm={() => confirmImport.mutate(selectedImportId)}
            onPageChange={setPreviewPage}
            rows={previewQuery.data?.items ?? []}
            summary={{
              totalRows: selectedJob?.totalRows ?? 0,
              validRows: selectedJob?.validRows ?? 0,
              invalidRows: selectedJob?.invalidRows ?? 0,
            }}
            total={previewQuery.data?.total ?? 0}
          />
        </ImportPreviewModal>
      ) : null}
    </section>
  );
}
