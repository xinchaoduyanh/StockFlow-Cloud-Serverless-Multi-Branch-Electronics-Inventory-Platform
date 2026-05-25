"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { useCurrentUser, useLogout } from "@/features/auth/use-auth";

type Branch = {
  id: string;
  code: string;
  name: string;
};

type ComponentCategory = "RAM" | "CPU" | "SSD" | "GPU" | "MAINBOARD" | "PSU" | "CASE" | "COOLER";

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
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "FAILED" | "CANCELLED";
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
  status: string;
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
  validationStatus: string;
  errorMessage: string | null;
  normalizedData: Record<string, unknown> | null;
};

const categories: ComponentCategory[] = [
  "RAM",
  "CPU",
  "SSD",
  "GPU",
  "MAINBOARD",
  "PSU",
  "CASE",
  "COOLER",
];

const tabs = [
  { id: "inventory", label: "Inventory" },
  { id: "transfers", label: "Transfers" },
  { id: "imports", label: "Imports" },
  { id: "low-stock", label: "Low stock" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function DashboardPage() {
  const [hasMounted, setHasMounted] = useState(false);
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
  const [rejectReason, setRejectReason] = useState("Not approved");
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
    onSuccess: (job) => {
      setSelectedImportId(job.id);
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
    const pendingTransfers = transferItems.filter((item) => item.status === "PENDING").length;

    return [
      { label: "Total units", value: totalUnits.toLocaleString(), tone: "text-[#0f766e]" },
      { label: "Reserved", value: reservedUnits.toLocaleString(), tone: "text-[#7c3aed]" },
      { label: "Low stock", value: lowStockItems.length.toLocaleString(), tone: "text-[#dc2626]" },
      {
        label: "Pending transfers",
        value: pendingTransfers.toLocaleString(),
        tone: "text-[#ca8a04]",
      },
    ];
  }, [inventoryItems, lowStockItems.length, transferItems]);

  if (!hasMounted || isLoading) {
    return <ShellMessage>Loading...</ShellMessage>;
  }

  if (error || !user) {
    return <ShellMessage>Redirecting to login...</ShellMessage>;
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
    <main className="min-h-screen bg-[#f4f7fb]">
      <header className="sticky top-0 z-30 border-b border-[#d7dce5] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-[calc(100%_-_48px)] max-w-[1240px] items-center justify-between gap-4 py-3 max-md:w-[calc(100%_-_32px)] max-md:flex-col max-md:items-start">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f766e] text-sm font-black text-white shadow-lg shadow-teal-800/15">
              SF
            </div>
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">
                StockFlow Cloud
              </p>
              <h1 className="m-0 text-xl font-black tracking-normal text-[#172033]">
                Inventory Operations
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm max-md:w-full max-md:justify-between">
            <span className="max-w-[240px] truncate text-[#5c667a]">{user.email}</span>
            <span className="rounded-md border border-[#d7dce5] bg-[#f8fafc] px-2 py-1 font-black text-[#172033]">
              {user.role}
            </span>
            <button className="button-secondary" onClick={logout} type="button">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-[calc(100%_-_48px)] max-w-[1240px] gap-4 py-5 max-md:w-[calc(100%_-_32px)]">
        <section className="surface grid gap-4 p-5">
          <div className="grid gap-3 md:grid-cols-4">
            {inventorySummary.map((item) => (
              <div key={item.label} className="rounded-md border border-[#d7dce5] bg-[#f8fafc] p-4">
                <p className={`m-0 text-2xl font-black ${item.tone}`}>{item.value}</p>
                <p className="m-0 mt-1 text-xs font-black uppercase tracking-[0.08em] text-[#5c667a]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_180px_220px] gap-3 max-md:grid-cols-1">
            <label className="field">
              <span>Search SKU or name</span>
              <input
                className="input"
                onChange={(event) => setSearch(event.target.value)}
                value={search}
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                className="input"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                <option value="">All</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Branch</span>
              <select
                className="input"
                onChange={(event) => setBranchId(event.target.value)}
                value={selectedBranchId}
              >
                <option value="">All branches</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <nav className="flex flex-wrap gap-2 rounded-xl border border-[#d7dce5] bg-slate-50 p-1">
            {tabs.map((tab) => (
              <button
                className={tab.id === activeTab ? "tab-active" : "tab"}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </section>

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
          <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <form
              className="surface grid h-fit gap-4 p-4"
              onSubmit={handleCreateTransfer}
            >
              <div><p className="m-0 text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">Transfer</p><h2 className="m-0 mt-1 text-lg font-black">Create request</h2></div>
              <label className="field">
                <span>From branch</span>
                <select
                  className="input"
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, fromBranchId: event.target.value }))
                  }
                  required
                  value={transferForm.fromBranchId}
                >
                  <option value="">Select branch</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Component</span>
                <select
                  className="input"
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, componentId: event.target.value }))
                  }
                  required
                  value={transferForm.componentId}
                >
                  <option value="">Select stock item</option>
                  {transferComponents.map((item) => (
                    <option key={`${item.branchId}-${item.componentId}`} value={item.componentId}>
                      {item.component.sku} - {item.component.name} (
                      {item.quantity - item.reservedQuantity} available)
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Quantity</span>
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
                <span>Note</span>
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
              <button className="button-primary" disabled={createTransfer.isPending} type="submit">
                {createTransfer.isPending ? "Creating..." : "Create request"}
              </button>
            </form>

            <div className="grid gap-3">
              <label className="surface field p-4">
                <span>Reject reason</span>
                <input
                  className="input"
                  onChange={(event) => setRejectReason(event.target.value)}
                  value={rejectReason}
                />
              </label>
              <TransferList
                isAdmin={user.role === "ADMIN"}
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
          <section className="grid gap-4">
            <div className="surface flex items-center justify-between gap-4 p-5 max-sm:flex-col max-sm:items-start">
              <div>
                <h2 className="m-0 text-lg font-black tracking-tight text-[#172033]">Spreadsheet Ingestion</h2>
                <p className="m-0 mt-1 text-xs font-medium text-[#5c667a]">Upload, audit, preview, and commit Excel inventory files.</p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="button-primary px-5"
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>Ingest Spreadsheet</span>
              </button>
            </div>

            {/* Ingestion Glassmorphic Modal Dialog */}
            {isUploadModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md animate-macbook-backdrop">
                <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-2xl shadow-slate-950/20 animate-macbook-modal">
                  {/* Close Modal Button */}
                  <button
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setSelectedFile(null);
                      setUploadProgress(null);
                      setIngestionStage(null);
                    }}
                    className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    type="button"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <form className="grid gap-5" onSubmit={handleUpload}>
                    <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                      <h2 className="m-0 text-lg font-bold text-[#172033]">Ingest Spreadsheet</h2>
                      <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-semibold text-[#0f766e] tracking-wider uppercase">
                        S3 Direct
                      </span>
                    </div>

                    <label className="field">
                      <span className="text-sm font-semibold text-[#475569]">Target Branch</span>
                      <select
                        className="input mt-1.5 border-[#cbd5e1] focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] rounded-lg transition-all"
                        onChange={(event) => setImportBranchId(event.target.value)}
                        required
                        value={importBranchId}
                      >
                        <option value="">Select branch for inventory destination</option>
                        {branchOptions.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.code} - {branch.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Drag and Drop Zone */}
                    <div className="field">
                      <span className="text-sm font-semibold text-[#475569]">Spreadsheet (.xlsx)</span>
                      {!selectedFile ? (
                        <div
                          className={`mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
                            isDragOver
                              ? "border-[#0f766e] bg-teal-50/30 scale-[0.98]"
                              : "border-[#cbd5e1] bg-[#f8fafc] hover:border-[#0f766e] hover:bg-slate-50/50"
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
                          <svg className="mx-auto h-8 w-8 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mt-2 text-xs font-semibold text-[#334155]">Drag and drop spreadsheet here</p>
                          <p className="mt-1 text-[11px] text-[#64748b]">
                            or <span className="text-[#0f766e] underline font-semibold cursor-pointer">browse your computer</span>
                          </p>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/10 p-4 shadow-sm">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-[#0f766e]">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="overflow-hidden">
                              <p className="truncate text-xs font-semibold text-[#1e293b]">{selectedFile.name}</p>
                              <p className="text-[10px] text-[#64748b]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                            }}
                            className="rounded-full p-1 text-[#94a3b8] hover:bg-slate-100 hover:text-[#ef4444] transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {uploadProgress !== null && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-[#334155] flex items-center gap-1.5 font-semibold">
                            {ingestionStage === "uploading" ? "Uploading to S3..." : "Validating database staging..."}
                          </span>
                          <span className="font-bold text-[#0f766e]">{uploadProgress}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {uploadImportDirect.error && (
                      <div className="flex gap-2 rounded-lg bg-rose-50 p-3 text-xs text-[#ef4444] border border-rose-100">
                        <p>{messageFromError(uploadImportDirect.error)}</p>
                      </div>
                    )}

                    <button
                      className="button-primary w-full py-2.5"
                      disabled={uploadImportDirect.isPending || !selectedFile || !importBranchId}
                      type="submit"
                    >
                      {uploadImportDirect.isPending ? "Processing Pipeline..." : "Begin Ingestion"}
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
              <ImportPreviewModal
                job={selectedImportJob}
                onClose={() => setSelectedImportId("")}
              >
                <ImportPreview
                  isLoading={previewQuery.isLoading}
                  rows={previewQuery.data ?? []}
                  canConfirm={Boolean(selectedImportJob?.status === "PREVIEW_READY")}
                  onConfirm={() => selectedImportId && confirmImport.mutate(selectedImportId)}
                  isConfirming={confirmImport.isPending}
                  currentPage={previewPage}
                  onPageChange={setPreviewPage}
                />
              </ImportPreviewModal>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ShellMessage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-[calc(100%_-_48px)] max-w-[960px] py-16 max-md:w-[calc(100%_-_32px)] max-md:py-8 animate-fade-in">
      <section className="rounded-xl border border-border bg-white p-7 shadow-sm">{children}</section>
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
    <section className="surface overflow-hidden">
      <TableHeader title="Inventory list" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Category</th>
              <th>Branch</th>
              <th>Quantity</th>
              <th>Reserved</th>
              <th>Min stock</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={7} text="Loading inventory..." /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={7} text="No inventory found." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={`${item.branchId}-${item.componentId}`}>
                  <td className="font-bold">{item.component.sku}</td>
                  <td>{item.component.name}</td>
                  <td>{item.component.category}</td>
                  <td>{item.branch.code}</td>
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
    <section className="surface overflow-hidden">
      <TableHeader title="Low stock report" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Branch</th>
              <th>Quantity</th>
              <th>Threshold</th>
              <th>Shortage</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={6} text="Loading low stock..." /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={6} text="No low-stock items." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={`${item.branchId}-${item.componentId}`}>
                  <td className="font-bold">{item.component.sku}</td>
                  <td>{item.component.name}</td>
                  <td>{item.branch.code}</td>
                  <td>{item.quantity}</td>
                  <td>{item.minStockThreshold}</td>
                  <td className="font-bold text-red-700">
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
    <section className="surface overflow-hidden">
      <TableHeader title="Transfer requests" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Route</th>
              <th>Items</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={5} text="Loading transfers..." /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={5} text="No transfer requests." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <StatusPill status={item.status} />
                  </td>
                  <td>
                    {item.fromBranch.code} to {item.toBranch.code}
                  </td>
                  <td>
                    {item.items.map((line) => `${line.component.sku} x${line.quantity}`).join(", ")}
                  </td>
                  <td>{item.rejectReason ?? item.note ?? "-"}</td>
                  <td>
                    {isAdmin && item.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          className="button-small-primary"
                          onClick={() => onApprove(item.id)}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="button-small-secondary"
                          onClick={() => onReject(item.id)}
                          type="button"
                        >
                          Reject
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
    <section className="surface overflow-hidden">
      <TableHeader title="Import jobs" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Branch</th>
              <th>Upload Time</th>
              <th>Status</th>
              <th>Rows</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={6} text="Loading imports..." /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={6} text="No imports yet." />
            ) : null}
            {!isLoading &&
              paginatedItems.map((item) => {
                const isProcessing = item.status === "UPLOADED" || item.status === "VALIDATING";
                return (
                  <tr key={item.id}>
                    <td className="font-bold">{item.fileName ?? "Untitled"}</td>
                    <td>{item.branch.code}</td>
                    <td className="text-xs text-[#5c667a]">
                      {new Date(item.createdAt).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td>
                      <StatusPill status={item.status} />
                    </td>
                    <td>
                      {isProcessing ? (
                        <span className="text-xs italic text-muted">Processing...</span>
                      ) : (
                        `${item.validRows} valid / ${item.invalidRows} invalid`
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
                        title={isProcessing ? "File is still processing in cloud" : "Click to preview staged rows"}
                      >
                        {item.status === "VALIDATING" ? "Parsing..." : "Preview"}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md animate-macbook-backdrop">
      <div className="relative grid max-h-[90vh] w-full max-w-[1120px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25 animate-macbook-modal">
        <div className="flex items-center justify-between gap-4 border-b border-border bg-slate-50/80 px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]">Import preview</p>
            <h2 className="m-0 mt-1 truncate text-lg font-black text-[#172033]">{job?.fileName ?? "Spreadsheet preview"}</h2>
          </div>
          <button className="button-secondary min-h-9 px-3" onClick={onClose} type="button" aria-label="Close preview">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
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
  const validCount = rows.filter((row) => row.validationStatus === "VALID").length;
  const invalidCount = rows.length - validCount;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      {/* Spacious Widescreen Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border p-4 max-md:flex-col max-md:items-start bg-slate-50/70">
        <div>
          <h2 className="m-0 text-lg font-black text-[#172033] tracking-tight uppercase flex items-center gap-2">
            <svg className="h-5 w-5 text-[#0f766e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ingestion Details & Audit Workspace
          </h2>
          <p className="text-xs text-[#5c667a] mt-0.5 font-medium">Verify spreadsheet layout staging before final cloud write</p>
        </div>
        
        {rows.length > 0 ? (
          canConfirm ? (
            <button
              className="button-primary bg-[#0f766e] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01]"
              disabled={validCount === 0 || isConfirming}
              onClick={onConfirm}
              type="button"
            >
              {isConfirming ? "Confirming..." : "Confirm import"}
            </button>
          ) : (
            <span className="text-xs font-bold text-[#0f766e] bg-teal-50 border border-teal-200/50 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm animate-pulse">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Ingested & Synced
            </span>
          )
        ) : null}
      </div>

      {rows.length > 0 ? (
        /* Spacious Stats Cards Section */
        <div className="grid grid-cols-1 gap-3 border-b border-border bg-slate-50/20 p-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#64748b] tracking-wider">Total Rows Staged</span>
              <p className="text-2xl font-black text-[#1e293b] mt-1">{rows.length}</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/10 p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Valid Rows</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">{validCount}</p>
            </div>
            <div className="rounded-lg bg-emerald-100/50 p-2 text-emerald-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/10 p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-rose-600 tracking-wider">Invalid / Failed Rows</span>
              <p className="text-2xl font-black text-rose-700 mt-1">{invalidCount}</p>
            </div>
            <div className="rounded-lg bg-rose-100/50 p-2 text-rose-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-20">Row</th>
              <th className="w-40">SKU</th>
              <th>Name / Details</th>
              <th className="w-32">Status</th>
              <th>Validation Errors / Notes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={5} text="Loading preview..." /> : null}
            {!isLoading && rows.length === 0 ? (
              <TableState colSpan={5} text="Select an import job to display interactive audit logs." />
            ) : null}
            {!isLoading &&
              paginatedRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                  <td className="font-semibold text-slate-500">{row.rowNumber}</td>
                  <td className="font-bold text-[#1e293b]">{row.sku ?? "-"}</td>
                  <td className="font-medium text-[#334155]">{String(row.normalizedData?.name ?? "-")}</td>
                  <td>
                    <StatusPill status={row.validationStatus} />
                  </td>
                  <td className="max-w-[450px] whitespace-normal text-xs text-rose-700 font-semibold leading-relaxed">
                    {row.errorMessage ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {row.errorMessage}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                        </svg>
                        Ready for Cloud Storage
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
    <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-white px-4 py-3 sm:px-6 rounded-b-lg">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="relative inline-flex items-center rounded-md border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="relative ml-3 inline-flex items-center rounded-md border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-medium text-[#334155] hover:bg-slate-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-[#64748b] font-medium">
            Showing <span className="font-bold text-[#1e293b]">{startIdx}</span> to{" "}
            <span className="font-bold text-[#1e293b]">{endIdx}</span> of{" "}
            <span className="font-bold text-[#1e293b]">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="relative inline-flex items-center rounded-l-md px-2 py-1.5 text-[#64748b] ring-1 ring-inset ring-[#e2e8f0] hover:bg-slate-50 disabled:opacity-40"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
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
                  className={`relative inline-flex items-center px-3 py-1.5 text-xs font-semibold focus:z-20 ${
                    isCurrent
                      ? "z-10 bg-[#0f766e] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]"
                      : "text-[#334155] ring-1 ring-inset ring-[#e2e8f0] hover:bg-slate-50 focus:outline-offset-0"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="relative inline-flex items-center rounded-r-md px-2 py-1.5 text-[#64748b] ring-1 ring-inset ring-[#e2e8f0] hover:bg-slate-50 disabled:opacity-40"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
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
        compact ? "" : "flex items-center justify-between gap-3 border-b border-border p-4 bg-slate-50/50"
      }
    >
      <h2 className="m-0 text-sm font-extrabold text-[#172033] tracking-tight uppercase">{title}</h2>
      <span className="text-xs font-bold text-[#5c667a] bg-slate-100 px-2 py-0.5 rounded-full">{count} items</span>
    </div>
  );
}

function TableState({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="py-8 text-center text-muted" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: string }) {
  let tone = "bg-slate-50 text-slate-700 border-slate-200";
  
  if (status === "VALID" || status === "COMPLETED" || status === "APPROVED") {
    tone = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
  } else if (status === "INVALID" || status === "REJECTED" || status === "FAILED") {
    tone = "bg-rose-50 text-rose-700 border-rose-200/50";
  } else if (status === "PROCESSING" || status === "VALIDATING" || status === "COMMITTING" || status === "PENDING") {
    tone = "bg-amber-50 text-amber-700 border-amber-200/50";
  }

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${tone}`}>
      {status}
    </span>
  );
}

function messageFromError(error: Error) {
  return error.message || "Request failed";
}
