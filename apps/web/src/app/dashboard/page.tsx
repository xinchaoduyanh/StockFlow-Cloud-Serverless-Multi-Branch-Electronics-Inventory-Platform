"use client";

import {
  COMPONENT_CATEGORIES,
  ComponentCategory,
  ExportJobStatus,
  ImportRowStatus,
  ImportStatus,
  ReconciliationStatus,
  ReportType,
  TransferStatus,
  UserRole,
  ReconciliationIssue,
} from "@stockflow/shared";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { useCurrentUser, useLogout } from "@/features/auth/use-auth";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UsersAdmin } from "@/features/users/UsersAdmin";
import { BranchesAdmin } from "@/features/branches/BranchesAdmin";

type Branch = {
  id: string;
  code: string;
  name: string;
};

type InventoryItem = {
  branchId: string;
  componentId: string;
  quantity: number;
  reservedQuantity: number;
  minStockThreshold: number;
  branch: Branch;
  component: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    category: ComponentCategory;
  };
};

type Transfer = {
  id: string;
  status: TransferStatus;
  note: string | null;
  rejectReason: string | null;
  createdAt: string;
  fromBranch: Branch;
  toBranch: Branch;
  items: Array<{
    id: string;
    quantity: number;
    component: {
      sku: string;
      name: string;
    };
  }>;
};

type ImportJob = {
  id: string;
  fileName: string | null;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  createdAt: string;
  branch: Branch;
};

type ImportPreviewRow = {
  id: string;
  rowNumber: number;
  sku: string | null;
  validationStatus: ImportRowStatus;
  errorMessage: string | null;
  normalizedData: Record<string, unknown> | null;
};

type ExportJob = {
  id: string;
  reportType: ReportType;
  status: ExportJobStatus;
  fileName: string | null;
  totalRecords: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type DlqJob = ImportJob;

const categories = COMPONENT_CATEGORIES;

const tabs = [
  { id: "inventory", label: "Tồn kho" },
  { id: "transfers", label: "Chuyển kho" },
  { id: "imports", label: "Nhập kho" },
  { id: "low-stock", label: "Cảnh báo tồn thấp" },
  { id: "reports", label: "Báo cáo & Thống kê" },
  { id: "dlq", label: "Quản trị lỗi (DLQ)", adminOnly: true },
  { id: "reconciliation", label: "Đối soát tồn kho", adminOnly: true },
  { id: "users", label: "Quản lý nhân viên", adminOnly: true },
  { id: "branches", label: "Quản lý chi nhánh", adminOnly: true },
] as const;

type TabId = (typeof tabs)[number]["id"];

function getTabIcon(id: string) {
  switch (id) {
    case "inventory":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      );
    case "transfers":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      );
    case "imports":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      );
    case "low-stock":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case "reports":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2z"
          />
        </svg>
      );
    case "dlq":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      );
    case "reconciliation":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      );
    case "users":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    case "branches":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function DashboardPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: user, isLoading, error } = useCurrentUser();
  const logout = useLogout();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted && !isLoading && (error || !user)) {
      router.replace("/login");
    }
  }, [hasMounted, isLoading, error, user, router]);
  const [activeTab, setActiveTab] = useState<TabId>("inventory");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [branchId, setBranchId] = useState("");
  const [transferForm, setTransferForm] = useState({
    fromBranchId: "",
    toBranchId: "",
    componentId: "",
    quantity: "1",
    note: "",
  });
  const [rejectReason, setRejectReason] = useState("Không được duyệt");
  const [importBranchId, setImportBranchId] = useState("");
  const [selectedImportId, setSelectedImportId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [ingestionStage, setIngestionStage] = useState<"uploading" | "validating" | null>(null);

  // High-end overhauls state variables
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [transfersPage, setTransfersPage] = useState(1);
  const [importsPage, setImportsPage] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [dlqPage, setDlqPage] = useState(1);
  const [reconPage, setReconPage] = useState(1);
  const [reconStatusFilter, setReconStatusFilter] = useState<ReconciliationStatus | "">("");

  // Reset pages when filters change
  useEffect(() => {
    setInventoryPage(1);
  }, [search, category, branchId]);

  useEffect(() => {
    setLowStockPage(1);
  }, [search, category, branchId]);

  useEffect(() => {
    if (user?.branchId && !importBranchId) {
      setImportBranchId(user.branchId);
    }
  }, [user, importBranchId]);

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiRequest<Branch[]>("/branches"),
    enabled: Boolean(user),
  });

  const selectedBranchId = branchId || user?.branchId || "";
  const inventoryQuery = useQuery({
    queryKey: ["inventory", search, category, selectedBranchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      return apiRequest<InventoryItem[]>(`/inventory?${params.toString()}`);
    },
    enabled: Boolean(user),
  });

  const lowStockQuery = useQuery({
    queryKey: ["inventory", "low-stock", selectedBranchId],
    queryFn: () => {
      const params = new URLSearchParams({ lowStock: "true" });
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      return apiRequest<InventoryItem[]>(`/inventory?${params.toString()}`);
    },
    enabled: Boolean(user),
  });

  const transfersQuery = useQuery({
    queryKey: ["transfers", selectedBranchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      return apiRequest<Transfer[]>(`/transfers?${params.toString()}`);
    },
    enabled: Boolean(user),
  });

  const importsQuery = useQuery({
    queryKey: ["imports", selectedBranchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      return apiRequest<ImportJob[]>(`/imports?${params.toString()}`);
    },
    enabled: Boolean(user),
    refetchInterval: (query) => {
      const hasActiveJobs = query.state.data?.some(
        (job) => job.status === ImportStatus.UPLOADED || job.status === ImportStatus.VALIDATING,
      );
      return hasActiveJobs ? 1500 : false;
    },
  });

  const previewQuery = useQuery({
    queryKey: ["imports", selectedImportId, "preview"],
    queryFn: () => apiRequest<ImportPreviewRow[]>(`/imports/${selectedImportId}/preview`),
    enabled: Boolean(selectedImportId),
  });

  const createTransfer = useMutation({
    mutationFn: () =>
      apiRequest<Transfer>("/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromBranchId: transferForm.fromBranchId,
          toBranchId: transferForm.toBranchId,
          note: transferForm.note || undefined,
          items: [
            {
              componentId: transferForm.componentId,
              quantity: Number(transferForm.quantity),
            },
          ],
        }),
      }),
    onSuccess: () => {
      setTransferForm((current) => ({ ...current, componentId: "", quantity: "1", note: "" }));
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const approveTransfer = useMutation({
    mutationFn: (id: string) => apiRequest(`/transfers/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const rejectTransfer = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/transfers/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transfers"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const uploadImportDirect = useMutation({
    mutationFn: async ({ branchId, file }: { branchId: string; file: File }) => {
      setUploadProgress(0);
      setIngestionStage("uploading");

      // 1. Fetch Presigned POST details
      const response = await apiRequest<{
        importJobId: string;
        presignedPost: { url: string; fields: Record<string, string> };
      }>("/imports/presigned-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          fileName: file.name,
        }),
      });

      // 2. Build S3 upload form payload
      const s3FormData = new FormData();
      Object.entries(response.presignedPost.fields).forEach(([key, value]) => {
        s3FormData.append(key, value);
      });
      // S3 requirement: file MUST be the absolute last field in the FormData payload
      s3FormData.append("file", file);

      // 3. Upload directly to S3 Bucket with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", response.presignedPost.url);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(Math.min(pct, 99)); // Cap at 99% until S3 completely saves and returns
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            setIngestionStage("validating");
            resolve();
          } else {
            reject(new Error(`S3 Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during S3 upload"));
        xhr.send(s3FormData);
      });

      return { id: response.importJobId };
    },
    onSuccess: () => {
      setSelectedFile(null);
      setUploadProgress(null);
      setIngestionStage(null);
      setIsUploadModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
    onError: () => {
      setUploadProgress(null);
      setIngestionStage(null);
    },
  });

  const confirmImport = useMutation({
    mutationFn: (id: string) => apiRequest(`/imports/${id}/confirm`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["imports", selectedImportId, "preview"] });
    },
  });

  // --- Reports ---
  const exportsQuery = useQuery({
    queryKey: ["exports"],
    queryFn: () => apiRequest<ExportJob[]>("/reports/exports"),
    enabled: Boolean(user),
  });

  const createExport = useMutation({
    mutationFn: (reportType: ReportType) =>
      apiRequest<ExportJob>("/reports/export", {
        method: "POST",
        body: JSON.stringify({
          reportType,
          filters: branchId ? { branchId } : undefined,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exports"] });
    },
  });

  // --- DLQ Admin ---
  const dlqQuery = useQuery({
    queryKey: ["dlq-imports"],
    queryFn: () => apiRequest<DlqJob[]>("/admin/dlq/imports"),
    enabled: Boolean(user) && user?.role === UserRole.ADMIN,
  });

  const replayDlq = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/dlq/imports/${id}/replay`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dlq-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
  });

  const discardDlq = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/dlq/imports/${id}/discard`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dlq-imports"] });
    },
  });

  // --- Reconciliation ---
  const reconQuery = useQuery({
    queryKey: ["reconciliation", reconStatusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (reconStatusFilter) params.set("status", reconStatusFilter);
      return apiRequest<ReconciliationIssue[]>(`/reconciliation/issues?${params.toString()}`);
    },
    enabled: Boolean(user) && user?.role === UserRole.ADMIN,
  });

  const runRecon = useMutation({
    mutationFn: () => apiRequest("/reconciliation/run", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
    },
  });

  const resolveIssue = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/reconciliation/issues/${id}/resolve`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
    },
  });

  const branchOptions = branchesQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];
  const lowStockItems = lowStockQuery.data ?? [];
  const transferItems = transfersQuery.data ?? [];
  const importJobs = importsQuery.data ?? [];
  const selectedImportJob = useMemo(
    () => importJobs.find((job) => job.id === selectedImportId),
    [importJobs, selectedImportId],
  );
  const transferComponents = useMemo(
    () =>
      inventoryItems.filter(
        (item) => !transferForm.fromBranchId || item.branchId === transferForm.fromBranchId,
      ),
    [inventoryItems, transferForm.fromBranchId],
  );
  const inventorySummary = useMemo(() => {
    const totalUnits = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
    const reservedUnits = inventoryItems.reduce((sum, item) => sum + item.reservedQuantity, 0);
    const pendingTransfers = transferItems.filter(
      (item) => item.status === TransferStatus.PENDING,
    ).length;

    return [
      { label: "Tổng số lượng", value: totalUnits.toLocaleString(), tone: "teal" },
      { label: "Tạm giữ", value: reservedUnits.toLocaleString(), tone: "violet" },
      { label: "Cảnh báo tồn thấp", value: lowStockItems.length.toLocaleString(), tone: "rose" },
      {
        label: "Yêu cầu chờ duyệt",
        value: pendingTransfers.toLocaleString(),
        tone: "amber",
      },
    ];
  }, [inventoryItems, lowStockItems.length, transferItems]);

  if (!hasMounted || isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !user) {
    return <LoginRedirectSkeleton />;
  }

  function handleCreateTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTransfer.mutate();
  }

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || !importBranchId) {
      return;
    }
    uploadImportDirect.mutate({ branchId: importBranchId, file: selectedFile });
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex w-full">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 border-r border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/95 z-30">
        {/* Sidebar Header */}
        <div className="flex flex-col gap-1.5 px-6 py-5 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-accent-solid)] text-sm font-bold text-white shadow-sm shadow-indigo-500/25">
              SF
            </div>
            <div>
              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                StockFlow Cloud
              </p>
              <h1 className="m-0 text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Quản trị Kho hàng
              </h1>
            </div>
          </div>

          {/* Live Serverless System Status indicator */}
          <div className="flex items-center gap-2 mt-2 px-0.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-450 tracking-wide">
              Hệ thống: Trực tuyến
            </span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          {tabs
            .filter(
              (tab) => !("adminOnly" in tab && tab.adminOnly && user?.role !== UserRole.ADMIN),
            )
            .map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-r-xl text-sm font-medium transition-all duration-150 border-l-2 -ml-3 pl-4 ${
                    isActive
                      ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 font-semibold"
                      : "text-slate-650 dark:text-slate-400 border-transparent hover:bg-slate-50/70 dark:hover:bg-slate-900/40 hover:text-slate-950 dark:hover:text-slate-100"
                  }`}
                  type="button"
                >
                  <span
                    className={
                      isActive
                        ? "text-indigo-650 dark:text-indigo-400"
                        : "text-slate-400 dark:text-slate-500"
                    }
                  >
                    {getTabIcon(tab.id)}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex items-center gap-3 mb-4 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/60 shadow-sm shadow-slate-100/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-sm shadow-inner shrink-0">
              {user.email?.[0].toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user.email}
              </p>
              <p className="text-[9px] text-slate-550 dark:text-slate-450 uppercase tracking-widest font-bold mt-0.5">
                {user.role === "ADMIN"
                  ? "QUẢN TRỊ VIÊN"
                  : user.role === "STORE_MANAGER"
                    ? "QUẢN LÝ"
                    : "THỦ KHO"}
              </p>
            </div>
          </div>
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-450 dark:hover:text-rose-450 hover:bg-rose-50/50 dark:hover:bg-rose-950/25 transition-all duration-150"
            onClick={logout}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile Drawer */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />

          <aside className="relative flex flex-col w-64 max-w-xs bg-white dark:bg-slate-900 h-full z-10 shadow-2xl animate-rise-in border-r border-slate-200/60 dark:border-slate-800">
            {/* Close Button */}
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded-xl border border-slate-200/60 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-150"
                type="button"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Sidebar Header */}
            <div className="flex flex-col gap-1.5 px-6 py-5 border-b border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-accent-solid)] text-sm font-bold text-white shadow-sm">
                  SF
                </div>
                <div>
                  <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    StockFlow Cloud
                  </p>
                  <h1 className="m-0 text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    Quản trị Kho hàng
                  </h1>
                </div>
              </div>

              {/* Live Status */}
              <div className="flex items-center gap-2 mt-2 px-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-450 tracking-wide">
                  Hệ thống: Trực tuyến
                </span>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
              {tabs
                .filter(
                  (tab) => !("adminOnly" in tab && tab.adminOnly && user?.role !== UserRole.ADMIN),
                )
                .map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-r-xl text-sm font-medium transition-all duration-150 border-l-2 -ml-3 pl-4 ${
                        isActive
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 font-semibold"
                          : "text-slate-655 dark:text-slate-400 border-transparent hover:bg-slate-50/70 dark:hover:bg-slate-900/40 hover:text-slate-950 dark:hover:text-slate-100"
                      }`}
                      type="button"
                    >
                      <span
                        className={
                          isActive
                            ? "text-indigo-650 dark:text-indigo-400"
                            : "text-slate-400 dark:text-slate-500"
                        }
                      >
                        {getTabIcon(tab.id)}
                      </span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-3 mb-4 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/60 shadow-sm shadow-slate-100/10">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-sm shadow-inner shrink-0">
                  {user.email?.[0].toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user.email}
                  </p>
                  <p className="text-[9px] text-slate-550 dark:text-slate-450 uppercase tracking-widest font-bold mt-0.5">
                    {user.role === "ADMIN"
                      ? "QUẢN TRỊ VIÊN"
                      : user.role === "STORE_MANAGER"
                        ? "QUẢN LÝ"
                        : "THỦ KHO"}
                  </p>
                </div>
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-455 dark:hover:text-rose-455 hover:bg-rose-50/50 dark:hover:bg-rose-950/25 transition-all duration-150"
                onClick={logout}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Đăng xuất</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/60 dark:border-slate-800 bg-[#f8fafc]/95 dark:bg-slate-900/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between px-6 gap-4">
            <div className="flex items-center gap-4">
              {/* Hamburger Menu Toggle on Mobile */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                type="button"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <h2 className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Content Body Container */}
        <main className="flex-1 p-6 md:p-8 space-y-6 max-w-[1240px] w-full mx-auto">
          {/* Main Dashboard Stats cards & filters ONLY rendered when on Inventory tab */}
          {activeTab === "inventory" && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-rise-in">
                {inventorySummary.map((item) => {
                  const { bgBadge, textBadge, metricIcon } = (() => {
                    if (item.tone === "teal") {
                      return {
                        bgBadge: "bg-teal-50 dark:bg-teal-950/30",
                        textBadge: "text-teal-600 dark:text-teal-400",
                        metricIcon: (
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        ),
                      };
                    } else if (item.tone === "violet") {
                      return {
                        bgBadge: "bg-violet-50 dark:bg-violet-950/30",
                        textBadge: "text-violet-600 dark:text-violet-400",
                        metricIcon: (
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        ),
                      };
                    } else if (item.tone === "rose") {
                      return {
                        bgBadge: "bg-rose-50 dark:bg-rose-950/30",
                        textBadge: "text-rose-600 dark:text-rose-400",
                        metricIcon: (
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        ),
                      };
                    } else {
                      return {
                        bgBadge: "bg-amber-50 dark:bg-amber-950/30",
                        textBadge: "text-amber-600 dark:text-amber-400",
                        metricIcon: (
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                            />
                          </svg>
                        ),
                      };
                    }
                  })();

                  return (
                    <div
                      key={item.label}
                      className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 active:translate-y-0 hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between h-32"
                    >
                      {/* Top Row: Label & Icon */}
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          {item.label}
                        </span>
                        <div
                          className={`p-2 rounded-xl ${bgBadge} ${textBadge} transition-transform duration-300 hover:rotate-6`}
                        >
                          {metricIcon}
                        </div>
                      </div>

                      {/* Bottom Row: Large Value */}
                      <div className="mt-auto">
                        <p className="m-0 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white tabular-nums">
                          {item.value}
                        </p>
                      </div>

                      {/* Subtle accent bar at the top */}
                      <div
                        className={`absolute top-0 inset-x-0 h-1 ${
                          item.tone === "teal"
                            ? "bg-teal-500"
                            : item.tone === "violet"
                              ? "bg-violet-500"
                              : item.tone === "rose"
                                ? "bg-rose-500"
                                : "bg-amber-500"
                        }`}
                      />
                    </div>
                  );
                })}
              </section>

              {/* Filters for SKU, category, and branch */}
              <section className="surface grid grid-cols-[1fr_220px_280px] gap-4 p-4 max-md:grid-cols-1 animate-rise-in-delay-1">
                <label className="field">
                  <span>Tìm theo SKU hoặc tên</span>
                  <input
                    className="input"
                    onChange={(event) => setSearch(event.target.value)}
                    value={search}
                    placeholder="Nhập mã SKU hoặc tên..."
                  />
                </label>
                <label className="field">
                  <span>Danh mục</span>
                  <select
                    className="input"
                    onChange={(event) => setCategory(event.target.value)}
                    value={category}
                  >
                    <option value="">Tất cả danh mục</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Chi nhánh</span>
                  <select
                    className="input"
                    onChange={(event) => setBranchId(event.target.value)}
                    value={selectedBranchId}
                  >
                    <option value="">Tất cả chi nhánh</option>
                    {branchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code} - {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </>
          )}

          {/* Filters also showing on low-stock tab (very helpful for navigation) but NO summary cards */}
          {activeTab === "low-stock" && (
            <section className="surface grid grid-cols-[1fr_220px_280px] gap-4 p-4 max-md:grid-cols-1 animate-rise-in">
              <label className="field">
                <span>Tìm theo SKU hoặc tên</span>
                <input
                  className="input"
                  onChange={(event) => setSearch(event.target.value)}
                  value={search}
                  placeholder="Nhập mã SKU hoặc tên..."
                />
              </label>
              <label className="field">
                <span>Danh mục</span>
                <select
                  className="input"
                  onChange={(event) => setCategory(event.target.value)}
                  value={category}
                >
                  <option value="">Tất cả danh mục</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Chi nhánh</span>
                <select
                  className="input"
                  onChange={(event) => setBranchId(event.target.value)}
                  value={selectedBranchId}
                >
                  <option value="">Tất cả chi nhánh</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          {activeTab === "inventory" ? (
            <InventoryTable
              isLoading={inventoryQuery.isLoading}
              items={inventoryItems}
              currentPage={inventoryPage}
              onPageChange={setInventoryPage}
            />
          ) : null}

          {activeTab === "low-stock" ? (
            <LowStockReport
              isLoading={lowStockQuery.isLoading}
              items={lowStockQuery.data ?? []}
              currentPage={lowStockPage}
              onPageChange={setLowStockPage}
            />
          ) : null}

          {activeTab === "transfers" ? (
            <section className="grid gap-5 lg:grid-cols-[340px_1fr] animate-rise-in-delay-1">
              <form className="surface grid h-fit gap-5 p-5" onSubmit={handleCreateTransfer}>
                <div>
                  <p className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    Yêu cầu chuyển kho
                  </p>
                  <h2 className="m-0 mt-1 text-lg font-semibold text-slate-950">Tạo yêu cầu</h2>
                </div>
                <label className="field">
                  <span>Chi nhánh gửi</span>
                  <select
                    className="input"
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        fromBranchId: event.target.value,
                      }))
                    }
                    required
                    value={transferForm.fromBranchId}
                  >
                    <option value="">Chọn chi nhánh gửi</option>
                    {branchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code} - {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Chi nhánh nhận</span>
                  <select
                    className="input"
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        toBranchId: event.target.value,
                      }))
                    }
                    required
                    value={transferForm.toBranchId}
                  >
                    <option value="">Chọn chi nhánh nhận</option>
                    {branchOptions
                      .filter((branch) => branch.id !== transferForm.fromBranchId)
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.code} - {branch.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>Linh kiện</span>
                  <select
                    className="input"
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        componentId: event.target.value,
                      }))
                    }
                    required
                    value={transferForm.componentId}
                  >
                    <option value="">Chọn sản phẩm trong kho</option>
                    {transferComponents.map((item) => (
                      <option key={`${item.branchId}-${item.componentId}`} value={item.componentId}>
                        {item.component.sku} - {item.component.name} (
                        {item.quantity - item.reservedQuantity} khả dụng)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Số lượng</span>
                  <input
                    className="input"
                    min="1"
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, quantity: event.target.value }))
                    }
                    required
                    type="number"
                    value={transferForm.quantity}
                  />
                </label>
                <label className="field">
                  <span>Ghi chú</span>
                  <textarea
                    className="input min-h-20"
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, note: event.target.value }))
                    }
                    value={transferForm.note}
                  />
                </label>
                {createTransfer.error ? (
                  <p className="error-text">{messageFromError(createTransfer.error)}</p>
                ) : null}
                <button
                  className="button-primary"
                  disabled={createTransfer.isPending}
                  type="submit"
                >
                  {createTransfer.isPending ? "Đang tạo..." : "Tạo yêu cầu"}
                </button>
              </form>

              <div className="grid gap-4">
                <label className="surface field p-5">
                  <span>Lý do từ chối</span>
                  <input
                    className="input"
                    onChange={(event) => setRejectReason(event.target.value)}
                    value={rejectReason}
                  />
                </label>
                <TransferList
                  isAdmin={user.role === UserRole.ADMIN}
                  isLoading={transfersQuery.isLoading}
                  items={transferItems}
                  onApprove={(id) => approveTransfer.mutate(id)}
                  onReject={(id) => rejectTransfer.mutate(id)}
                  currentPage={transfersPage}
                  onPageChange={setTransfersPage}
                />
              </div>
            </section>
          ) : null}

          {activeTab === "imports" ? (
            <section className="grid gap-5 animate-rise-in-delay-1">
              <div className="surface relative overflow-hidden flex items-center justify-between gap-4 p-6 max-sm:flex-col max-sm:items-start">
                <div>
                  <div className="mb-2 inline-flex rounded-md border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                    Nhập kho từ đám mây
                  </div>
                  <h2 className="m-0 text-xl font-semibold tracking-tight text-slate-950">
                    Nhập kho bằng bảng tính Excel
                  </h2>
                  <p className="m-0 mt-1.5 text-sm font-normal text-slate-500">
                    Tải lên, kiểm tra, xem trước và lưu trữ tệp hàng tồn kho Excel.
                  </p>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="button-primary min-h-12 px-5"
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>Nhập bảng tính</span>
                </button>
              </div>

              {/* Ingestion Glassmorphic Modal Dialog */}
              {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm animate-macbook-backdrop">
                  <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-black/[0.04] bg-white p-8 shadow-[0_24px_64px_rgba(15,23,42,0.16)] animate-macbook-modal">
                    {/* Close Modal Button */}
                    <button
                      onClick={() => {
                        setIsUploadModalOpen(false);
                        setSelectedFile(null);
                        setUploadProgress(null);
                        setIngestionStage(null);
                      }}
                      className="absolute top-5 right-5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      type="button"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    <form className="grid gap-5" onSubmit={handleUpload}>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h2 className="m-0 text-base font-semibold text-slate-950 tracking-tight">
                          Nhập kho từ tệp Excel
                        </h2>
                        <span className="rounded-md border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600">
                          Tải lên S3
                        </span>
                      </div>

                      <label className="field">
                        <span>Chi nhánh nhận</span>
                        <select
                          className="input mt-1.5"
                          onChange={(event) => setImportBranchId(event.target.value)}
                          required
                          value={importBranchId}
                        >
                          <option value="">Chọn chi nhánh nhận hàng tồn kho</option>
                          {branchOptions.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.code} - {branch.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Drag and Drop Zone */}
                      <div className="field">
                        <span>Bảng tính Excel (.xlsx)</span>
                        {!selectedFile ? (
                          <div
                            className={`mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-7 text-center transition-colors duration-200 ${
                              isDragOver
                                ? "border-slate-400 bg-slate-50"
                                : "border-slate-200 bg-slate-50/60 hover:border-slate-400 hover:bg-white"
                            }`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragOver(true);
                            }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragOver(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file && file.name.endsWith(".xlsx")) {
                                setSelectedFile(file);
                              }
                            }}
                            onClick={() => {
                              const input = document.getElementById("file-upload-input");
                              input?.click();
                            }}
                          >
                            <input
                              id="file-upload-input"
                              className="hidden"
                              type="file"
                              accept=".xlsx"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setSelectedFile(file);
                              }}
                            />
                            <svg
                              className="mx-auto h-8 w-8 text-[#64748b]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                            <p className="mt-2 text-xs font-semibold text-[#334155]">
                              Kéo và thả bảng tính vào đây
                            </p>
                            <p className="mt-1 text-[11px] text-[#64748b]">
                              hoặc{" "}
                              <span className="cursor-pointer font-medium text-slate-900 underline underline-offset-4">
                                chọn tệp từ máy tính
                              </span>
                            </p>
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200/70 bg-white p-4">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700">
                                <svg
                                  className="h-5 w-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </div>
                              <div className="overflow-hidden">
                                <p className="truncate text-xs font-semibold text-[#1e293b]">
                                  {selectedFile.name}
                                </p>
                                <p className="text-[10px] text-[#64748b]">
                                  {(selectedFile.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                              }}
                              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {uploadProgress !== null && (
                        <div className="rounded-lg border border-slate-200/70 bg-slate-50 p-4">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-[#334155] flex items-center gap-1.5 font-semibold">
                              {ingestionStage === "uploading"
                                ? "Đang tải lên S3..."
                                : "Đang xác thực dữ liệu..."}
                            </span>
                            <span className="font-medium text-slate-950">{uploadProgress}%</span>
                          </div>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-slate-900 transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {uploadImportDirect.error && (
                        <div className="flex gap-2 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-red-600">
                          <p>{messageFromError(uploadImportDirect.error)}</p>
                        </div>
                      )}

                      <button
                        className="button-primary w-full py-2.5"
                        disabled={uploadImportDirect.isPending || !selectedFile || !importBranchId}
                        type="submit"
                      >
                        {uploadImportDirect.isPending
                          ? "Đang xử lý nhập kho..."
                          : "Bắt đầu nhập kho"}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              <ImportJobsTable
                isLoading={importsQuery.isLoading}
                items={importJobs}
                selectedId={selectedImportId}
                onSelect={(id) => {
                  setPreviewPage(1);
                  setSelectedImportId(id);
                }}
                currentPage={importsPage}
                onPageChange={setImportsPage}
              />

              {selectedImportId ? (
                <ImportPreviewModal job={selectedImportJob} onClose={() => setSelectedImportId("")}>
                  <ImportPreview
                    isLoading={previewQuery.isLoading}
                    rows={previewQuery.data ?? []}
                    canConfirm={Boolean(selectedImportJob?.status === ImportStatus.PREVIEW_READY)}
                    onConfirm={() => selectedImportId && confirmImport.mutate(selectedImportId)}
                    isConfirming={confirmImport.isPending}
                    currentPage={previewPage}
                    onPageChange={setPreviewPage}
                  />
                </ImportPreviewModal>
              ) : null}
            </section>
          ) : null}

          {activeTab === "reports" ? (
            <ReportsTab
              exports={exportsQuery.data ?? []}
              isLoading={exportsQuery.isLoading}
              onCreateExport={(type) => createExport.mutate(type)}
              isCreating={createExport.isPending}
              currentPage={reportsPage}
              onPageChange={setReportsPage}
            />
          ) : null}

          {activeTab === "dlq" && user?.role === UserRole.ADMIN ? (
            <DlqTab
              items={dlqQuery.data ?? []}
              isLoading={dlqQuery.isLoading}
              onReplay={(id) => replayDlq.mutate(id)}
              onDiscard={(id) => discardDlq.mutate(id)}
              isReplaying={replayDlq.isPending}
              currentPage={dlqPage}
              onPageChange={setDlqPage}
            />
          ) : null}

          {activeTab === "reconciliation" && user?.role === UserRole.ADMIN ? (
            <ReconciliationTab
              issues={reconQuery.data ?? []}
              isLoading={reconQuery.isLoading}
              onRun={() => runRecon.mutate()}
              onResolve={(id) => resolveIssue.mutate(id)}
              isRunning={runRecon.isPending}
              statusFilter={reconStatusFilter}
              onStatusFilterChange={setReconStatusFilter}
              currentPage={reconPage}
              onPageChange={setReconPage}
            />
          ) : null}

          {activeTab === "users" && user?.role === UserRole.ADMIN ? <UsersAdmin /> : null}

          {activeTab === "branches" && user?.role === UserRole.ADMIN ? <BranchesAdmin /> : null}
        </main>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <main className="app-background pb-14">
      <header className="content-layer sticky top-0 z-30 border-b border-slate-200/60 bg-[#f8fafc]/95 backdrop-blur-sm">
        <div className="mx-auto flex w-[calc(100%_-_48px)] max-w-[1240px] items-center justify-between gap-4 py-4 max-md:w-[calc(100%_-_32px)]">
          <div className="flex items-center gap-3.5">
            <div className="skeleton-shimmer h-11 w-11 rounded-2xl" />
            <div className="grid gap-2">
              <div className="skeleton-shimmer h-3 w-28" />
              <div className="skeleton-shimmer h-5 w-44" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="skeleton-shimmer h-8 w-56 max-sm:hidden" />
            <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
            <div className="skeleton-shimmer h-10 w-24 rounded-xl" />
          </div>
        </div>
      </header>
      <div className="content-layer mx-auto grid w-[calc(100%_-_48px)] max-w-[1240px] gap-8 py-8 max-md:w-[calc(100%_-_32px)]">
        <section className="surface grid gap-6 p-6 animate-rise-in md:p-7">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-black/[0.04] bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.02)]"
              >
                <div className="skeleton-shimmer h-8 w-20" />
                <div className="skeleton-shimmer mt-3 h-3 w-28" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_220px_280px] gap-4 rounded-xl border border-slate-200/60 bg-slate-50/80 p-4 max-md:grid-cols-1">
            <div className="skeleton-shimmer h-11 w-full" />
            <div className="skeleton-shimmer h-11 w-full" />
            <div className="skeleton-shimmer h-11 w-full" />
          </div>
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200/60 bg-slate-50 p-1.5">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton-shimmer h-11 w-28 rounded-xl" />
            ))}
          </div>
        </section>
        <section className="surface overflow-hidden animate-rise-in-delay-1">
          <div className="flex items-center justify-between border-b border-slate-200/60 bg-slate-50 p-4">
            <div className="skeleton-shimmer h-4 w-32" />
            <div className="skeleton-shimmer h-6 w-16 rounded-full" />
          </div>
          <div className="grid gap-3 p-5">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr] gap-4 max-md:grid-cols-2"
              >
                <div className="skeleton-shimmer h-5 w-full" />
                <div className="skeleton-shimmer h-5 w-full" />
                <div className="skeleton-shimmer h-5 w-full" />
                <div className="skeleton-shimmer h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function LoginRedirectSkeleton() {
  return (
    <main className="app-background grid place-items-center px-6 py-16 animate-fade-in">
      <section className="content-layer grid w-full max-w-[420px] gap-5 rounded-xl border border-black/[0.04] bg-white p-8 text-center shadow-[0_2px_8px_rgba(15,23,42,0.02)] animate-rise-in">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-[#18181b] text-base font-semibold text-white">
          SF
        </div>
        <div className="skeleton-shimmer mx-auto h-5 w-44" />
        <div className="skeleton-shimmer mx-auto h-3 w-64" />
        <div className="grid gap-3 pt-2">
          <div className="skeleton-shimmer h-11 w-full" />
          <div className="skeleton-shimmer h-11 w-full" />
        </div>
      </section>
    </main>
  );
}

function InventoryTable({
  items,
  isLoading,
  currentPage,
  onPageChange,
}: {
  items: InventoryItem[];
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Danh sách tồn kho" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Chi nhánh</th>
              <th>Số lượng</th>
              <th>Tạm giữ</th>
              <th>Mức tối thiểu</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={7} text="Đang tải dữ liệu tồn kho..." /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={7} text="Không tìm thấy dữ liệu tồn kho." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={`${item.branchId}-${item.componentId}`}>
                  <td className="font-medium text-slate-800 dark:text-slate-200">
                    {item.component.sku}
                  </td>
                  <td>{item.component.name}</td>
                  <td>{item.component.category}</td>
                  <td>
                    <span className="inline-flex rounded-md border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-355">
                      {item.branch.code}
                    </span>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{item.reservedQuantity}</td>
                  <td>{item.minStockThreshold}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={items.length}
        pageSize={pageSize}
      />
    </section>
  );
}

function LowStockReport({
  items,
  isLoading,
  currentPage,
  onPageChange,
}: {
  items: InventoryItem[];
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Báo cáo tồn kho thấp" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Tên sản phẩm</th>
              <th>Chi nhánh</th>
              <th>Số lượng</th>
              <th>Mức tối thiểu</th>
              <th>Thiếu hụt</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={6} text="Đang tải dữ liệu tồn thấp..." /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={6} text="Không có sản phẩm nào dưới mức tối thiểu." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={`${item.branchId}-${item.componentId}`}>
                  <td className="font-medium text-slate-800 dark:text-slate-200">
                    {item.component.sku}
                  </td>
                  <td>{item.component.name}</td>
                  <td>
                    <span className="inline-flex rounded-md border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-355">
                      {item.branch.code}
                    </span>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{item.minStockThreshold}</td>
                  <td className="font-medium text-red-700 dark:text-red-400">
                    {Math.max(item.minStockThreshold - item.quantity, 0)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={items.length}
        pageSize={pageSize}
      />
    </section>
  );
}

function TransferList({
  items,
  isLoading,
  isAdmin,
  onApprove,
  onReject,
  currentPage,
  onPageChange,
}: {
  items: Transfer[];
  isLoading: boolean;
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Yêu cầu chuyển kho" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Trạng thái</th>
              <th>Lộ trình</th>
              <th>Sản phẩm</th>
              <th>Ghi chú / Lý do</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableState colSpan={5} text="Đang tải danh sách yêu cầu chuyển kho..." />
            ) : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={5} text="Không có yêu cầu chuyển kho nào." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <StatusPill status={item.status} />
                  </td>
                  <td>
                    {item.fromBranch.code} sang {item.toBranch.code}
                  </td>
                  <td>
                    {item.items.map((line) => `${line.component.sku} x${line.quantity}`).join(", ")}
                  </td>
                  <td>{item.rejectReason ?? item.note ?? "-"}</td>
                  <td>
                    {isAdmin && item.status === TransferStatus.PENDING ? (
                      <div className="flex gap-2">
                        <button
                          className="button-small-primary"
                          onClick={() => onApprove(item.id)}
                          type="button"
                        >
                          Duyệt
                        </button>
                        <button
                          className="button-small-secondary"
                          onClick={() => onReject(item.id)}
                          type="button"
                        >
                          Từ chối
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={items.length}
        pageSize={pageSize}
      />
    </section>
  );
}

function ImportJobsTable({
  items,
  isLoading,
  selectedId,
  onSelect,
  currentPage,
  onPageChange,
}: {
  items: ImportJob[];
  isLoading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Danh sách nhập kho" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tệp tin</th>
              <th>Chi nhánh</th>
              <th>Thời gian tải lên</th>
              <th>Trạng thái</th>
              <th>Số dòng</th>
              <th>Xem chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={6} text="Đang tải danh sách nhập kho..." /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={6} text="Chưa có yêu cầu nhập kho nào." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => {
                const isProcessing =
                  item.status === ImportStatus.UPLOADED || item.status === ImportStatus.VALIDATING;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.fileName ?? "Không tên"}
                      </div>
                      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Bảng tính Excel
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex rounded-md border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-355">
                        {item.branch.code}
                      </span>
                    </td>
                    <td className="text-xs font-normal text-slate-500">
                      {new Date(item.createdAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      <StatusPill status={item.status} />
                    </td>
                    <td>
                      {isProcessing ? (
                        <span className="text-xs italic text-muted">Đang xử lý...</span>
                      ) : (
                        `${item.validRows} hợp lệ / ${item.invalidRows} không hợp lệ`
                      )}
                    </td>
                    <td>
                      <button
                        className={
                          isProcessing
                            ? "button-small-secondary opacity-50 cursor-not-allowed"
                            : selectedId === item.id
                              ? "button-small-primary"
                              : "button-small-secondary"
                        }
                        onClick={() => !isProcessing && onSelect(item.id)}
                        type="button"
                        disabled={isProcessing}
                        title={
                          isProcessing
                            ? "Tệp tin đang được xử lý trên đám mây"
                            : "Nhấp để xem trước các dòng đã nạp"
                        }
                      >
                        {item.status === ImportStatus.VALIDATING
                          ? "Đang phân tích..."
                          : "Xem trước"}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={items.length}
        pageSize={pageSize}
      />
    </section>
  );
}

function ImportPreviewModal({
  job,
  onClose,
  children,
}: {
  job: ImportJob | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm animate-macbook-backdrop">
      <div className="relative grid max-h-[90vh] w-full max-w-[1120px] overflow-hidden rounded-xl border border-black/[0.04] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.16)] animate-macbook-modal">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 bg-slate-50 px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Xem trước nhập kho
            </p>
            <h2 className="m-0 mt-1 truncate text-lg font-semibold text-slate-950">
              {job?.fileName ?? "Xem trước bảng tính"}
            </h2>
          </div>
          <button
            className="button-secondary min-h-9 px-3"
            onClick={onClose}
            type="button"
            aria-label="Đóng xem trước"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Đóng
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function ImportPreview({
  rows,
  isLoading,
  canConfirm,
  isConfirming,
  onConfirm,
  currentPage,
  onPageChange,
}: {
  rows: ImportPreviewRow[];
  isLoading: boolean;
  canConfirm: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 6;
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const validCount = rows.filter((row) => row.validationStatus === ImportRowStatus.VALID).length;
  const invalidCount = rows.length - validCount;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
      {/* Spacious Widescreen Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 bg-slate-50 p-4 max-md:flex-col max-md:items-start">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950">
            <svg
              className="h-5 w-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Chi tiết nhập kho & Không gian kiểm tra
          </h2>
          <p className="mt-0.5 text-xs font-normal text-slate-500">
            Kiểm tra cấu trúc bảng tính trước khi lưu chính thức
          </p>
        </div>

        {rows.length > 0 ? (
          canConfirm ? (
            <button
              className="button-primary px-5 py-2.5"
              disabled={validCount === 0 || isConfirming}
              onClick={onConfirm}
              type="button"
            >
              {isConfirming ? "Đang xác nhận..." : "Xác nhận nhập kho"}
            </button>
          ) : (
            <span className="flex items-center gap-2 rounded-md border border-slate-200/70 bg-white px-4 py-2 text-xs font-medium text-slate-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Đã nhập & Đồng bộ
            </span>
          )
        ) : null}
      </div>

      {rows.length > 0 ? (
        /* Spacious Stats Cards Section */
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200/60 bg-slate-50 p-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-white p-4">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Tổng số dòng đã nạp
              </span>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{rows.length}</p>
            </div>
            <div className="rounded-md bg-slate-100 p-2 text-slate-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-emerald-100/70 bg-white p-4">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">
                Dòng hợp lệ
              </span>
              <p className="mt-1 text-2xl font-semibold text-emerald-800">{validCount}</p>
            </div>
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-rose-100/70 bg-white p-4">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-rose-700">
                Dòng lỗi / Không hợp lệ
              </span>
              <p className="mt-1 text-2xl font-semibold text-rose-800">{invalidCount}</p>
            </div>
            <div className="rounded-md bg-rose-50 p-2 text-rose-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-20">Dòng</th>
              <th className="w-40">SKU</th>
              <th>Tên / Chi tiết</th>
              <th className="w-32">Trạng thái</th>
              <th>Lỗi kiểm tra / Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={5} text="Đang tải bản xem trước..." /> : null}
            {!isLoading && rows.length === 0 ? (
              <TableState
                colSpan={5}
                text="Chọn một phiên nhập kho để hiển thị nhật ký kiểm tra."
              />
            ) : null}
            {!isLoading &&
              paginatedRows.map((row) => (
                <tr key={row.id} className="transition-colors duration-150 hover:bg-slate-50/70">
                  <td className="font-normal text-slate-500">{row.rowNumber}</td>
                  <td className="font-medium text-slate-800">{row.sku ?? "-"}</td>
                  <td className="font-normal text-slate-700">
                    {String(row.normalizedData?.name ?? "-")}
                  </td>
                  <td>
                    <StatusPill status={row.validationStatus} />
                  </td>
                  <td className="max-w-[450px] whitespace-normal text-xs font-normal leading-relaxed text-rose-700">
                    {row.errorMessage ? (
                      <span className="flex items-center gap-1.5">
                        <svg
                          className="h-4 w-4 shrink-0 text-rose-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        {row.errorMessage}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <svg
                          className="h-4 w-4 shrink-0 text-emerald-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M9 12l2 2 4-4"
                          />
                        </svg>
                        Sẵn sàng lưu trữ
                      </span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalItems={rows.length}
        pageSize={pageSize}
      />
    </section>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}) {
  if (totalPages <= 1) return null;

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between rounded-b-lg border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="relative inline-flex items-center rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          Trước
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="relative ml-3 inline-flex items-center rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          Sau
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-normal text-slate-500 dark:text-slate-400">
            Hiển thị từ{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">{startIdx}</span> đến{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">{endIdx}</span> trong
            số <span className="font-medium text-slate-800 dark:text-slate-200">{totalItems}</span>{" "}
            kết quả
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md" aria-label="Phân trang">
            <button
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="relative inline-flex items-center rounded-l-md px-2 py-1.5 text-slate-500 dark:text-slate-400 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`relative inline-flex items-center px-3 py-1.5 text-xs font-medium focus:z-20 ${
                    isCurrent
                      ? "z-10 bg-[var(--color-accent-solid)] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                      : "text-slate-700 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-offset-0"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="relative inline-flex items-center rounded-r-md px-2 py-1.5 text-slate-500 dark:text-slate-400 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

function TableHeader({
  title,
  count,
  compact = false,
}: {
  title: string;
  count: number;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? ""
          : "flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4"
      }
    >
      <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
        {title}
      </h2>
      <span className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
        {count} mục
      </span>
    </div>
  );
}

function TableState({ colSpan, text }: { colSpan: number; text: string }) {
  const isLoading =
    text.toLowerCase().startsWith("loading") || text.toLowerCase().startsWith("đang");

  if (isLoading) {
    return (
      <>
        {[0, 1, 2, 3, 4, 5].map((rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: colSpan }).map((_, colIndex) => {
              const widthClass =
                colIndex === 0 ? "w-44" : colIndex === colSpan - 1 ? "w-20" : "w-28";
              return (
                <td key={colIndex}>
                  <div className={"skeleton-shimmer h-5 " + widthClass} />
                </td>
              );
            })}
          </tr>
        ))}
      </>
    );
  }

  return (
    <tr>
      <td className="py-12 text-center text-sm font-normal text-slate-400" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: string }) {
  let tone = "border-slate-200/70 bg-slate-50 text-slate-600";

  if (
    status === ImportRowStatus.VALID ||
    status === ExportJobStatus.COMPLETED ||
    status === TransferStatus.APPROVED ||
    status === "RESOLVED"
  ) {
    tone = "border-emerald-200/70 bg-emerald-50 text-emerald-800";
  } else if (
    status === ImportRowStatus.INVALID ||
    status === TransferStatus.REJECTED ||
    status === ExportJobStatus.FAILED ||
    status === "OPEN"
  ) {
    tone = "border-rose-200/70 bg-rose-50 text-rose-800";
  } else if (
    status === ExportJobStatus.PROCESSING ||
    status === ImportStatus.VALIDATING ||
    status === ImportStatus.COMMITTING ||
    status === TransferStatus.PENDING
  ) {
    tone = "border-amber-200/70 bg-amber-50 text-amber-800";
  } else if (status === ImportStatus.UPLOADED || status === ImportStatus.PREVIEW_READY) {
    tone = "border-slate-200/70 bg-slate-50 text-slate-700";
  }

  let statusText = status;
  if (status === "VALID") statusText = "HỢP LỆ";
  else if (status === "INVALID") statusText = "LỖI DÒNG";
  else if (status === "COMPLETED") statusText = "HOÀN THÀNH";
  else if (status === "FAILED") statusText = "THẤT BẠI";
  else if (status === "APPROVED") statusText = "ĐÃ DUYỆT";
  else if (status === "REJECTED") statusText = "TỪ CHỐI";
  else if (status === "RESOLVED") statusText = "ĐÃ ĐỐI SOÁT";
  else if (status === "OPEN") statusText = "CHƯA ĐỐI SOÁT";
  else if (status === "PENDING") statusText = "CHỜ DUYỆT";
  else if (status === "PROCESSING") statusText = "ĐANG XỬ LÝ";
  else if (status === "VALIDATING") statusText = "ĐANG PHÂN TÍCH";
  else if (status === "COMMITTING") statusText = "ĐANG LƯU KHO";
  else if (status === "UPLOADED") statusText = "ĐÃ TẢI LÊN";
  else if (status === "PREVIEW_READY") statusText = "ĐÃ NẠP XONG";

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${tone}`}
    >
      {statusText}
    </span>
  );
}

function messageFromError(error: Error) {
  return error.message || "Yêu cầu thất bại";
}

const reportTypes = [
  { id: ReportType.INVENTORY, label: "Báo cáo tồn kho", icon: "INV" },
  { id: ReportType.LOW_STOCK, label: "Cảnh báo tồn thấp", icon: "LOW" },
  { id: ReportType.TRANSFERS, label: "Lịch sử chuyển kho", icon: "TRF" },
  { id: ReportType.IMPORT_HISTORY, label: "Lịch sử nhập kho", icon: "IMP" },
  { id: ReportType.STOCK_MOVEMENTS, label: "Biến động kho", icon: "MOV" },
] as const;

function ReportsTab({
  exports: exportJobs,
  isLoading,
  onCreateExport,
  isCreating,
  currentPage,
  onPageChange,
}: {
  exports: ExportJob[];
  isLoading: boolean;
  onCreateExport: (type: ReportType) => void;
  isCreating: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(exportJobs.length / pageSize);
  const paginatedItems = exportJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="grid gap-4 animate-rise-in-delay-1">
      <div className="surface p-5">
        <div className="mb-4">
          <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            Xuất báo cáo dữ liệu
          </h2>
          <p className="m-0 mt-1.5 text-sm font-normal text-slate-500 dark:text-slate-400">
            Tạo báo cáo CSV từ dữ liệu kho hàng và tải xuống trực tiếp từ S3.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {reportTypes.map((report) => (
            <button
              key={report.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-left transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 hover:scale-[1.02]"
              onClick={() => onCreateExport(report.id)}
              disabled={isCreating}
              type="button"
            >
              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
                {report.icon}
              </span>
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {report.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="surface overflow-hidden">
        <TableHeader title="Lịch sử xuất báo cáo" count={exportJobs.length} />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loại báo cáo</th>
                <th>Trạng thái</th>
                <th>Số dòng dữ liệu</th>
                <th>Tệp tin</th>
                <th>Thời gian tạo</th>
                <th>Tải xuống</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableState colSpan={6} text="Đang tải lịch sử xuất báo cáo..." />
              ) : null}
              {!isLoading && exportJobs.length === 0 ? (
                <TableState
                  colSpan={6}
                  text="Chưa có báo cáo nào được xuất. Nhấp vào loại báo cáo ở trên để tạo."
                />
              ) : null}
              {!isLoading &&
                paginatedItems.map((job) => (
                  <tr key={job.id}>
                    <td className="font-medium text-slate-800 dark:text-slate-200">
                      {job.reportType === ReportType.INVENTORY
                        ? "Báo cáo tồn kho"
                        : job.reportType === ReportType.LOW_STOCK
                          ? "Cảnh báo tồn thấp"
                          : job.reportType === ReportType.TRANSFERS
                            ? "Lịch sử chuyển kho"
                            : job.reportType === ReportType.IMPORT_HISTORY
                              ? "Lịch sử nhập kho"
                              : "Biến động kho"}
                    </td>
                    <td>
                      <StatusPill status={job.status} />
                    </td>
                    <td>{job.totalRecords ?? "-"}</td>
                    <td className="text-xs font-normal text-slate-500">{job.fileName ?? "-"}</td>
                    <td className="text-xs font-normal text-slate-500">
                      {new Date(job.createdAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      {job.status === ExportJobStatus.COMPLETED ? (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/reports/export/${job.id}/download`}
                          className="button-small-primary no-underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Tải xuống
                        </a>
                      ) : job.status === ExportJobStatus.FAILED ? (
                        <span className="text-xs text-red-600" title={job.errorMessage ?? ""}>
                          Lỗi
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted">Đang xử lý...</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalItems={exportJobs.length}
          pageSize={pageSize}
        />
      </div>
    </section>
  );
}

function DlqTab({
  items,
  isLoading,
  onReplay,
  onDiscard,
  isReplaying,
  currentPage,
  onPageChange,
}: {
  items: DlqJob[];
  isLoading: boolean;
  onReplay: (id: string) => void;
  onDiscard: (id: string) => void;
  isReplaying: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="grid gap-4 animate-rise-in-delay-1">
      <div className="surface p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Hàng đợi lỗi (DLQ)
            </h2>
            <p className="m-0 mt-1.5 text-sm font-normal text-slate-500 dark:text-slate-400">
              Các yêu cầu nhập kho bị lỗi có thể được thử lại hoặc hủy bỏ. Hiện có {items.length}{" "}
              yêu cầu lỗi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-rose-200/70 dark:border-rose-950/30 bg-rose-50 dark:bg-rose-950/20 px-3 py-1 text-xs font-medium text-rose-800 dark:text-rose-400">
              {items.length} lỗi
            </span>
          </div>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <TableHeader title="Yêu cầu nhập kho lỗi" count={items.length} />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tệp tin</th>
                <th>Chi nhánh</th>
                <th>Trạng thái</th>
                <th>Số dòng</th>
                <th>Thời gian tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableState colSpan={6} text="Đang tải danh sách yêu cầu lỗi..." />
              ) : null}
              {!isLoading && items.length === 0 ? (
                <TableState colSpan={6} text="Không có yêu cầu nhập kho lỗi nào. Hệ thống sạch." />
              ) : null}
              {!isLoading &&
                paginatedItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.fileName ?? "Không tên"}
                      </div>
                      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Bảng tính Excel
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex rounded-md border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-355">
                        {item.branch.code}
                      </span>
                    </td>
                    <td>
                      <StatusPill status={item.status} />
                    </td>
                    <td>
                      {item.validRows} hợp lệ / {item.invalidRows} lỗi
                    </td>
                    <td className="text-xs font-normal text-slate-500">
                      {new Date(item.createdAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="button-small-primary"
                          onClick={() => onReplay(item.id)}
                          disabled={isReplaying}
                          type="button"
                          title="Đặt lại và chạy lại quy trình nhập kho"
                        >
                          Thử lại
                        </button>
                        <button
                          className="button-small-secondary"
                          onClick={() => onDiscard(item.id)}
                          type="button"
                          title="Đánh dấu là đã hủy"
                        >
                          Hủy bỏ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalItems={items.length}
          pageSize={pageSize}
        />
      </div>
    </section>
  );
}

function ReconciliationTab({
  issues,
  isLoading,
  onRun,
  onResolve,
  isRunning,
  statusFilter,
  onStatusFilterChange,
  currentPage,
  onPageChange,
}: {
  issues: ReconciliationIssue[];
  isLoading: boolean;
  onRun: () => void;
  onResolve: (id: string) => void;
  isRunning: boolean;
  statusFilter: ReconciliationStatus | "";
  onStatusFilterChange: (v: ReconciliationStatus | "") => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 8;
  const totalPages = Math.ceil(issues.length / pageSize);
  const paginatedItems = issues.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="grid gap-4 animate-rise-in-delay-1">
      <div className="surface p-5">
        <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
          <div>
            <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Đối soát tồn kho
            </h2>
            <p className="m-0 mt-1.5 text-sm font-normal text-slate-500 dark:text-slate-400">
              So sánh số lượng tồn kho với sổ đăng ký biến động kho để phát hiện chênh lệch.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="input max-w-[160px] text-xs"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as ReconciliationStatus | "")}
            >
              <option value="">Tất cả trạng thái</option>
              <option value={ReconciliationStatus.OPEN}>Chưa đối soát</option>
              <option value={ReconciliationStatus.RESOLVED}>Đã đối soát</option>
              <option value={ReconciliationStatus.IGNORED}>Bỏ qua</option>
            </select>
            <button
              className="button-primary min-h-12 px-5"
              onClick={onRun}
              disabled={isRunning}
              type="button"
            >
              {isRunning ? "Đang chạy..." : "Chạy đối soát"}
            </button>
          </div>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <TableHeader title="Chênh lệch đối soát" count={issues.length} />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Chi nhánh</th>
                <th>SKU</th>
                <th>Sản phẩm</th>
                <th>Sổ sách</th>
                <th>Thực tế</th>
                <th>Chênh lệch</th>
                <th>Trạng thái</th>
                <th>Phát hiện</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableState colSpan={9} text="Đang tải danh sách chênh lệch đối soát..." />
              ) : null}
              {!isLoading && issues.length === 0 ? (
                <TableState
                  colSpan={9}
                  text="Không phát hiện chênh lệch nào. Dữ liệu kho khớp hoàn toàn."
                />
              ) : null}
              {!isLoading &&
                paginatedItems.map((issue) => (
                  <tr key={issue.id}>
                    <td className="font-medium text-slate-800 dark:text-slate-200">
                      {issue.branch.code}
                    </td>
                    <td className="font-medium text-slate-800 dark:text-slate-200">
                      {issue.component.sku}
                    </td>
                    <td className="text-xs">{issue.component.name}</td>
                    <td>{issue.expectedQuantity}</td>
                    <td>{issue.actualQuantity}</td>
                    <td>
                      <span
                        className={`font-medium ${
                          issue.difference > 0
                            ? "text-emerald-700"
                            : issue.difference < 0
                              ? "text-rose-700"
                              : "text-slate-500"
                        }`}
                      >
                        {issue.difference > 0 ? "+" : ""}
                        {issue.difference}
                      </span>
                    </td>
                    <td>
                      <StatusPill status={issue.status} />
                    </td>
                    <td className="text-xs font-normal text-slate-500">
                      {new Date(issue.detectedAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      {issue.status === ReconciliationStatus.OPEN ? (
                        <button
                          className="button-small-primary"
                          onClick={() => onResolve(issue.id)}
                          type="button"
                        >
                          Giải quyết
                        </button>
                      ) : (
                        <span className="text-xs text-muted">
                          {issue.resolvedAt
                            ? new Date(issue.resolvedAt).toLocaleDateString("vi-VN")
                            : "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalItems={issues.length}
          pageSize={pageSize}
        />
      </div>
    </section>
  );
}
