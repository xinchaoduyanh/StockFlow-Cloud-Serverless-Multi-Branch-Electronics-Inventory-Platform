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
import { BrandMark } from "@/components/BrandLogo";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/table/Pagination";
import { StatusBadge } from "@/components/table/StatusBadge";
import { TableHeader, TableState } from "@/components/table/TablePieces";
import { DesktopSidebar, MobileDrawer } from "@/features/dashboard/Sidebar";
import { StatCard } from "@/features/dashboard/StatCard";
import { USER_ROLE_LABELS } from "@/features/auth/role-labels";
import { UploadImportDialog } from "@/features/imports/UploadImportDialog";
import { RejectTransferDialog } from "@/features/transfers/RejectTransferDialog";
import { DASHBOARD_TABS, TabId } from "@/features/dashboard/tabs";
import { UsersAdmin } from "@/features/users/UsersAdmin";
import { BranchesAdmin } from "@/features/branches/BranchesAdmin";
import { RecoveryTab } from "@/features/recovery/RecoveryTab";
import { Icon } from "@/components/Icon";

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

type TransferUser = {
  id: string;
  fullName: string | null;
  role: string;
  branch: Branch | null;
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
  requestedByUser?: TransferUser | null;
  approvedByUser?: TransferUser | null;
  rejectedByUser?: TransferUser | null;
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

const categories = COMPONENT_CATEGORIES;

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
  const activeTabInfo = DASHBOARD_TABS.find((tab) => tab.id === activeTab) ?? DASHBOARD_TABS[0];
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
  const [importBranchId, setImportBranchId] = useState("");
  const [selectedImportId, setSelectedImportId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`/transfers/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
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
      {
        label: "Tổng số lượng",
        value: totalUnits.toLocaleString("vi-VN"),
        caption: "Cộng dồn trên các chi nhánh đang xem",
        icon: "package",
        tone: "neutral",
      },
      {
        label: "Đang tạm giữ",
        value: reservedUnits.toLocaleString("vi-VN"),
        caption: "Đã giữ cho yêu cầu chuyển kho",
        icon: "lock",
        tone: "accent",
      },
      {
        label: "Tồn thấp",
        value: lowStockItems.length.toLocaleString("vi-VN"),
        caption: "Mặt hàng đã chạm mức tối thiểu",
        icon: "alert",
        tone: lowStockItems.length > 0 ? "danger" : "neutral",
      },
      {
        label: "Chờ duyệt",
        value: pendingTransfers.toLocaleString("vi-VN"),
        caption: "Yêu cầu chuyển kho chưa xử lý",
        icon: "transfer",
        tone: pendingTransfers > 0 ? "accent" : "neutral",
      },
    ] as const;
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

  function submitUpload() {
    if (!selectedFile || !importBranchId) {
      return;
    }
    uploadImportDirect.mutate({ branchId: importBranchId, file: selectedFile });
  }

  function closeUploadDialog() {
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setUploadProgress(null);
    setIngestionStage(null);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex w-full">
      <DesktopSidebar
        activeTab={activeTab}
        onLogout={logout}
        onSelectTab={setActiveTab}
        user={user}
      />

      {isSidebarOpen ? (
        <MobileDrawer
          activeTab={activeTab}
          onClose={() => setIsSidebarOpen(false)}
          onLogout={logout}
          onSelectTab={setActiveTab}
          user={user}
        />
      ) : null}

      {/* Main Content Area */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-6 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Mở menu"
                className="icon-button -ml-2 lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                type="button"
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="m-0 truncate font-display text-lg font-semibold leading-tight tracking-tight">
                  {activeTabInfo.label}
                </h2>
                <p className="m-0 hidden truncate text-xs text-[var(--color-text-muted)] sm:block">
                  {activeTabInfo.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Content Body Container */}
        <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-6 p-6 md:p-8" id="main">
          {/* Main Dashboard Stats cards & filters ONLY rendered when on Inventory tab */}
          {activeTab === "inventory" && (
            <>
              <section
                aria-label="Tổng quan tồn kho"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-rise-in"
              >
                {inventorySummary.map((item) => (
                  <StatCard key={item.label} {...item} />
                ))}
              </section>

              {/* Filters for SKU, category, and branch */}
              <section className="surface grid grid-cols-[1fr_220px_280px] gap-4 p-4 max-md:grid-cols-1 animate-rise-in-delay-1">
                <label className="field">
                  <span>Tìm theo SKU hoặc tên</span>
                  <input
                    className="input"
                    onChange={(event) => setSearch(event.target.value)}
                    value={search}
                    placeholder="Nhập mã SKU hoặc tên…"
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
                  placeholder="Nhập mã SKU hoặc tên…"
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
                  <p className="m-0 text-xs font-medium text-slate-500">Yêu cầu chuyển kho</p>
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
                  {createTransfer.isPending ? "Đang tạo…" : "Tạo yêu cầu"}
                </button>
              </form>

              <div className="flex min-w-0 flex-col gap-4">
                <TransferList
                  isAdmin={user.role === UserRole.ADMIN}
                  isLoading={transfersQuery.isLoading}
                  items={transferItems}
                  onApprove={(id) => approveTransfer.mutate(id)}
                  onReject={(id, reason) => rejectTransfer.mutate({ id, reason })}
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
                  <div className="mb-2 inline-flex rounded-md border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
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
                  className="button-primary"
                  type="button"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  <span>Nhập bảng tính</span>
                </button>
              </div>

              {isUploadModalOpen ? (
                <UploadImportDialog
                  branchId={importBranchId}
                  branches={branchOptions}
                  error={uploadImportDirect.error}
                  file={selectedFile}
                  isPending={uploadImportDirect.isPending}
                  onBranchChange={setImportBranchId}
                  onClose={closeUploadDialog}
                  onFileChange={setSelectedFile}
                  onSubmit={submitUpload}
                  progress={uploadProgress}
                  stage={ingestionStage}
                />
              ) : null}

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

          {activeTab === "dlq" && user?.role === UserRole.ADMIN ? <RecoveryTab /> : null}

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
    <div className="flex min-h-screen w-full bg-[var(--color-bg-base)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <div className="skeleton-shimmer h-5 w-28" />
        </div>
        <div className="grid gap-2.5 pt-4">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="skeleton-shimmer h-9 w-full" key={item} />
          ))}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-border-subtle)] px-6 md:px-8">
          <div className="skeleton-shimmer h-6 w-40" />
          <div className="flex gap-2">
            <div className="skeleton-shimmer h-9 w-9" />
            <div className="skeleton-shimmer h-9 w-9" />
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[1240px] gap-6 p-6 md:p-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div className="surface grid gap-5 p-5" key={item}>
                <div className="skeleton-shimmer h-4 w-28" />
                <div className="skeleton-shimmer h-8 w-20" />
              </div>
            ))}
          </div>
          <div className="surface grid gap-3 p-5">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div className="skeleton-shimmer h-5 w-full" key={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginRedirectSkeleton() {
  return (
    <main className="app-background grid place-items-center px-6 py-16 animate-fade-in">
      <section className="content-layer grid w-full max-w-[420px] gap-5 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-bg-surface)] p-8 text-center [box-shadow:var(--color-card-shadow)] animate-rise-in">
        <div className="mx-auto">
          <BrandMark className="h-11 w-11" />
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
            {isLoading ? <TableState colSpan={7} text="Đang tải dữ liệu tồn kho…" /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={7} text="Không tìm thấy dữ liệu tồn kho." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={`${item.branchId}-${item.componentId}`}>
                  <td className="code">{item.component.sku}</td>
                  <td>{item.component.name}</td>
                  <td>{item.component.category}</td>
                  <td>
                    <span className="chip">{item.branch.code}</span>
                  </td>
                  <td
                    className={`font-mono tabular-nums ${item.quantity <= item.minStockThreshold ? "font-semibold text-rose-700 dark:text-rose-300" : ""}`}
                  >
                    {item.quantity}
                  </td>
                  <td className="font-mono tabular-nums">{item.reservedQuantity}</td>
                  <td className="font-mono tabular-nums">{item.minStockThreshold}</td>
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
              <th>Đang giữ</th>
              <th>Mức tối thiểu</th>
              <th>Thiếu hụt</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={7} text="Đang tải dữ liệu tồn thấp…" /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={7} text="Không có sản phẩm nào dưới mức tối thiểu." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={`${item.branchId}-${item.componentId}`}>
                  <td className="code">{item.component.sku}</td>
                  <td>{item.component.name}</td>
                  <td>
                    <span className="chip">{item.branch.code}</span>
                  </td>
                  <td
                    className={`font-mono tabular-nums ${item.quantity <= item.minStockThreshold ? "font-semibold text-rose-700 dark:text-rose-300" : ""}`}
                  >
                    {item.quantity}
                  </td>
                  <td className="font-mono tabular-nums">{item.reservedQuantity}</td>
                  <td className="font-mono tabular-nums">{item.minStockThreshold}</td>
                  <td className="font-medium text-red-700 dark:text-red-400">
                    {Math.max(item.minStockThreshold - (item.quantity - item.reservedQuantity), 0)}
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
  onReject: (id: string, reason: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const pageSize = 8;
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function renderUserBadge(user?: TransferUser | null) {
    if (!user) return <span className="text-slate-400">-</span>;
    const branchText = user.branch ? ` · ${user.branch.code}` : "";
    return (
      <div className="flex flex-col whitespace-nowrap text-left">
        <span className="text-sm font-medium text-slate-800">{user.fullName || "Ẩn danh"}</span>
        <span className="text-xs text-slate-500">
          {USER_ROLE_LABELS[user.role] ?? user.role}
          {branchText}
        </span>
      </div>
    );
  }

  function formatDate(dateString: string) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  }

  return (
    <section className="surface overflow-hidden animate-rise-in-delay-1">
      <TableHeader title="Yêu cầu chuyển kho" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Trạng thái</th>
              <th>Thời gian</th>
              <th>Lộ trình</th>
              <th>Sản phẩm</th>
              <th>Người yêu cầu</th>
              <th>Người phê duyệt</th>
              <th>Ghi chú / Lý do</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableState colSpan={8} text="Đang tải danh sách yêu cầu chuyển kho…" />
            ) : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={8} text="Không có yêu cầu chuyển kho nào." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="chip">{item.fromBranch.code}</span>
                    <Icon
                      name="chevronRight"
                      className="mx-0.5 inline h-3.5 w-3.5 text-slate-400"
                    />
                    <span className="chip">{item.toBranch.code}</span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      {item.items.map((line) => (
                        <div key={line.id} className="whitespace-nowrap">
                          <span className="code">{line.component.sku}</span>
                          <span className="ml-1.5 font-mono text-xs text-slate-500">
                            × {line.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>{renderUserBadge(item.requestedByUser)}</td>
                  <td>
                    {item.status === TransferStatus.COMPLETED ? (
                      renderUserBadge(item.approvedByUser)
                    ) : item.status === TransferStatus.REJECTED ? (
                      renderUserBadge(item.rejectedByUser)
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td
                    className="max-w-[200px] truncate text-xs text-slate-600"
                    title={item.rejectReason ?? item.note ?? ""}
                  >
                    {item.rejectReason ?? item.note ?? "-"}
                  </td>
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
                          onClick={() => setRejectingId(item.id)}
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
      {rejectingId ? (
        <RejectTransferDialog
          onCancel={() => setRejectingId(null)}
          onConfirm={(reason) => {
            onReject(rejectingId, reason);
            setRejectingId(null);
          }}
        />
      ) : null}
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
            {isLoading ? <TableState colSpan={6} text="Đang tải danh sách nhập kho…" /> : null}
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
                      <div className="font-medium text-slate-800">
                        {item.fileName ?? "Không tên"}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-500">Bảng tính Excel</div>
                    </td>
                    <td>
                      <span className="chip">{item.branch.code}</span>
                    </td>
                    <td className="text-xs font-normal text-slate-500">
                      {new Date(item.createdAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      {isProcessing ? (
                        <span className="text-xs italic text-muted">Đang xử lý…</span>
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
                        {item.status === ImportStatus.VALIDATING ? "Đang phân tích…" : "Xem trước"}
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
    <Modal
      description="Xem trước nhập kho"
      onClose={onClose}
      title={job?.fileName ?? "Xem trước bảng tính"}
      widthClassName="max-w-[1120px]"
    >
      {children}
    </Modal>
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
    <section className="overflow-hidden rounded-lg border border-slate-200/60 bg-[var(--color-bg-surface)]">
      {/* Spacious Widescreen Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 bg-slate-50 p-4 max-md:flex-col max-md:items-start">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950">
            <Icon name="file" className="h-5 w-5 text-slate-500" />
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
              {isConfirming ? "Đang xác nhận…" : "Xác nhận nhập kho"}
            </button>
          ) : (
            <span className="flex items-center gap-2 rounded-md border border-slate-200/70 bg-[var(--color-bg-surface)] px-4 py-2 text-xs font-medium text-slate-700">
              <Icon name="check" className="h-4 w-4" />
              Đã nhập & Đồng bộ
            </span>
          )
        ) : null}
      </div>

      {rows.length > 0 ? (
        /* Spacious Stats Cards Section */
        <div className="grid grid-cols-1 gap-3 border-b border-slate-200/60 bg-slate-50 p-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-[var(--color-bg-surface)] p-4">
            <div>
              <span className="text-xs font-medium r text-slate-500">Tổng số dòng đã nạp</span>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{rows.length}</p>
            </div>
            <div className="rounded-md bg-slate-100 p-2 text-slate-600">
              <Icon name="list" className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-emerald-100/70 bg-[var(--color-bg-surface)] p-4">
            <div>
              <span className="text-xs font-medium r text-emerald-700">Dòng hợp lệ</span>
              <p className="mt-1 text-2xl font-semibold text-emerald-800">{validCount}</p>
            </div>
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
              <Icon name="checkCircle" className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-rose-100/70 bg-[var(--color-bg-surface)] p-4">
            <div>
              <span className="text-xs font-medium r text-rose-700">Dòng lỗi / Không hợp lệ</span>
              <p className="mt-1 text-2xl font-semibold text-rose-800">{invalidCount}</p>
            </div>
            <div className="rounded-md bg-rose-50 p-2 text-rose-700">
              <Icon name="alert" className="h-5 w-5" />
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
            {isLoading ? <TableState colSpan={5} text="Đang tải bản xem trước…" /> : null}
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
                    <StatusBadge status={row.validationStatus} />
                  </td>
                  <td className="max-w-[450px] whitespace-normal text-xs font-normal leading-relaxed text-rose-700">
                    {row.errorMessage ? (
                      <span className="flex items-center gap-1.5">
                        <Icon name="alert" className="h-4 w-4 shrink-0 text-rose-500" />
                        {row.errorMessage}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-500" />
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

function messageFromError(error: Error) {
  return error.message || "Yêu cầu thất bại";
}

const reportTypes = [
  { id: ReportType.INVENTORY, label: "Báo cáo tồn kho", icon: "package" },
  { id: ReportType.LOW_STOCK, label: "Cảnh báo tồn thấp", icon: "alert" },
  { id: ReportType.TRANSFERS, label: "Lịch sử chuyển kho", icon: "transfer" },
  { id: ReportType.IMPORT_HISTORY, label: "Lịch sử nhập kho", icon: "upload" },
  { id: ReportType.STOCK_MOVEMENTS, label: "Biến động kho", icon: "list" },
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
          <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-950">
            Xuất báo cáo dữ liệu
          </h2>
          <p className="m-0 mt-1.5 text-sm font-normal text-slate-500">
            Tạo báo cáo CSV từ dữ liệu kho hàng và tải xuống trực tiếp từ S3.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {reportTypes.map((report) => (
            <button
              key={report.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-[var(--color-bg-surface)] p-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50 "
              onClick={() => onCreateExport(report.id)}
              disabled={isCreating}
              type="button"
            >
              <Icon
                name={report.icon}
                className="h-[18px] w-[18px] text-[var(--color-accent-solid)]"
              />
              <span className="text-xs font-medium text-slate-800">{report.label}</span>
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
              {isLoading ? <TableState colSpan={6} text="Đang tải lịch sử xuất báo cáo…" /> : null}
              {!isLoading && exportJobs.length === 0 ? (
                <TableState
                  colSpan={6}
                  text="Chưa có báo cáo nào được xuất. Nhấp vào loại báo cáo ở trên để tạo."
                />
              ) : null}
              {!isLoading &&
                paginatedItems.map((job) => (
                  <tr key={job.id}>
                    <td className="font-medium text-slate-800">
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
                      <StatusBadge status={job.status} />
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
                        <span className="text-xs italic text-muted">Đang xử lý…</span>
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
            <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-950">
              Đối soát tồn kho
            </h2>
            <p className="m-0 mt-1.5 text-sm font-normal text-slate-500">
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
            <button className="button-primary" onClick={onRun} disabled={isRunning} type="button">
              {isRunning ? "Đang chạy…" : "Chạy đối soát"}
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
                <TableState colSpan={9} text="Đang tải danh sách chênh lệch đối soát…" />
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
                    <td className="code">{issue.branch.code}</td>
                    <td className="code">{issue.component.sku}</td>
                    <td className="text-xs">{issue.component.name}</td>
                    <td className="font-mono tabular-nums">{issue.expectedQuantity}</td>
                    <td className="font-mono tabular-nums">{issue.actualQuantity}</td>
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
                      <StatusBadge status={issue.status} />
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
