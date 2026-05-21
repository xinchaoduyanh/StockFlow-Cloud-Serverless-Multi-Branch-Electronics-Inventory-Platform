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
    <main className="min-h-screen bg-[#f7f8fa]">
      <header className="border-b border-[#d7dce5] bg-white">
        <div className="mx-auto flex w-[calc(100%_-_48px)] max-w-[1240px] items-center justify-between gap-4 py-5 max-md:w-[calc(100%_-_32px)] max-md:flex-col max-md:items-start">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#0f766e] text-sm font-black text-white shadow-lg shadow-teal-800/15">
              SF
            </div>
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">
                StockFlow Cloud
              </p>
              <h1 className="m-0 text-2xl font-black tracking-normal text-[#172033]">
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

      <div className="mx-auto grid w-[calc(100%_-_48px)] max-w-[1240px] gap-5 py-6 max-md:w-[calc(100%_-_32px)]">
        <section className="grid gap-4 rounded-lg border border-[#d7dce5] bg-white p-5 shadow-sm">
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

          <nav className="flex flex-wrap gap-2 border-t border-[#d7dce5] pt-4">
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
          <InventoryTable isLoading={inventoryQuery.isLoading} items={inventoryItems} />
        ) : null}

        {activeTab === "low-stock" ? (
          <LowStockReport isLoading={lowStockQuery.isLoading} items={lowStockQuery.data ?? []} />
        ) : null}

        {activeTab === "transfers" ? (
          <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <form
              className="grid h-fit gap-4 rounded-lg border border-border bg-white p-4"
              onSubmit={handleCreateTransfer}
            >
              <h2 className="m-0 text-lg font-bold">Create transfer</h2>
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
                <span>To branch</span>
                <select
                  className="input"
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, toBranchId: event.target.value }))
                  }
                  required
                  value={transferForm.toBranchId}
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
              <label className="field rounded-lg border border-border bg-white p-4">
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
                items={transfersQuery.data ?? []}
                onApprove={(id) => approveTransfer.mutate(id)}
                onReject={(id) => rejectTransfer.mutate(id)}
              />
            </div>
          </section>
        ) : null}

        {activeTab === "imports" ? (
          <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <form
              className="grid h-fit gap-5 rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-md shadow-slate-200/50"
              onSubmit={handleUpload}
            >
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <h2 className="m-0 text-lg font-bold text-[#1e293b]">Ingest Spreadsheet</h2>
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-[#0f766e]">
                  S3 Direct Upload
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

              {/* Modern Interactive Drag and Drop Zone */}
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
                    <svg
                      className={`mx-auto h-10 w-10 text-[#64748b] transition-transform duration-300 ${
                        isDragOver ? "scale-110 text-[#0f766e]" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mt-3 text-sm font-medium text-[#334155]">
                      Drag and drop spreadsheet here
                    </p>
                    <p className="mt-1 text-xs text-[#64748b]">
                      or <span className="text-[#0f766e] underline font-semibold cursor-pointer">browse your computer</span>
                    </p>
                    <p className="mt-2.5 rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase font-bold text-[#64748b] tracking-wider">
                      Strictly XLSX limit 10MB
                    </p>
                  </div>
                ) : (
                  /* Premium Selected File Card */
                  <div className="mt-1.5 flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/10 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-[#0f766e]">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate text-sm font-semibold text-[#1e293b]">{selectedFile.name}</p>
                        <p className="text-xs text-[#64748b]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
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
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Gorgeous Real-Time Progress Bar Component */}
              {uploadProgress !== null && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#334155] flex items-center gap-1.5">
                      {ingestionStage === "uploading" ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-[#0f766e]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Uploading directly to S3
                        </>
                      ) : (
                        <>
                          <svg className="animate-pulse h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
                            <circle cx="12" cy="12" r="6" fill="currentColor" />
                          </svg>
                          Validating & Staging rows...
                        </>
                      )}
                    </span>
                    <span className="font-bold text-[#0f766e]">{uploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-100 shadow-inner overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(20,184,166,0.4)]"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-[#64748b] leading-relaxed">
                    {ingestionStage === "uploading"
                      ? "Uploading multipart spreadsheet binary to S3 signed gateway."
                      : "File safely received by AWS. Step Functions executing validations."}
                  </p>
                </div>
              )}

              {uploadImportDirect.error ? (
                <div className="flex gap-2 rounded-lg bg-rose-50 p-3 text-xs text-[#ef4444] border border-rose-100">
                  <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p>{messageFromError(uploadImportDirect.error)}</p>
                </div>
              ) : null}

              <button
                className="button-primary w-full py-2.5 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                disabled={uploadImportDirect.isPending || !selectedFile || !importBranchId}
                type="submit"
              >
                {uploadImportDirect.isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Processing Pipeline...</span>
                  </>
                ) : (
                  <span>Begin Cloud Ingestion</span>
                )}
              </button>
            </form>

            <div className="grid gap-4">
              <ImportJobsTable
                isLoading={importsQuery.isLoading}
                items={importsQuery.data ?? []}
                selectedId={selectedImportId}
                onSelect={setSelectedImportId}
              />
              <ImportPreview
                isLoading={previewQuery.isLoading}
                rows={previewQuery.data ?? []}
                canConfirm={Boolean(selectedImportId)}
                onConfirm={() => selectedImportId && confirmImport.mutate(selectedImportId)}
                isConfirming={confirmImport.isPending}
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ShellMessage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-[calc(100%_-_48px)] max-w-[960px] py-16 max-md:w-[calc(100%_-_32px)] max-md:py-8">
      <section className="rounded-lg border border-border bg-white p-7">{children}</section>
    </main>
  );
}

function InventoryTable({ items, isLoading }: { items: InventoryItem[]; isLoading: boolean }) {
  return (
    <section className="rounded-lg border border-border bg-white">
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
            {items.map((item) => (
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
    </section>
  );
}

function LowStockReport({ items, isLoading }: { items: InventoryItem[]; isLoading: boolean }) {
  return (
    <section className="rounded-lg border border-border bg-white">
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
            {items.map((item) => (
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
    </section>
  );
}

function TransferList({
  items,
  isLoading,
  isAdmin,
  onApprove,
  onReject,
}: {
  items: Transfer[];
  isLoading: boolean;
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-white">
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
            {items.map((item) => (
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
    </section>
  );
}

function ImportJobsTable({
  items,
  isLoading,
  selectedId,
  onSelect,
}: {
  items: ImportJob[];
  isLoading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-white">
      <TableHeader title="Import jobs" count={items.length} />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Rows</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={5} text="Loading imports..." /> : null}
            {!isLoading && items.length === 0 ? (
              <TableState colSpan={5} text="No imports yet." />
            ) : null}
            {items.map((item) => (
              <tr key={item.id}>
                <td className="font-bold">{item.fileName ?? "Untitled"}</td>
                <td>{item.branch.code}</td>
                <td>
                  <StatusPill status={item.status} />
                </td>
                <td>
                  {item.validRows} valid / {item.invalidRows} invalid
                </td>
                <td>
                  <button
                    className={
                      selectedId === item.id ? "button-small-primary" : "button-small-secondary"
                    }
                    onClick={() => onSelect(item.id)}
                    type="button"
                  >
                    Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImportPreview({
  rows,
  isLoading,
  canConfirm,
  isConfirming,
  onConfirm,
}: {
  rows: ImportPreviewRow[];
  isLoading: boolean;
  canConfirm: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
}) {
  const invalidCount = rows.filter((row) => row.validationStatus === "INVALID").length;

  return (
    <section className="rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4 max-md:flex-col max-md:items-start">
        <TableHeader title="Preview rows" count={rows.length} compact />
        <button
          className="button-primary"
          disabled={!canConfirm || invalidCount > 0 || isConfirming}
          onClick={onConfirm}
          type="button"
        >
          {isConfirming ? "Confirming..." : "Confirm import"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Row</th>
              <th>SKU</th>
              <th>Name</th>
              <th>Status</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableState colSpan={5} text="Loading preview..." /> : null}
            {!isLoading && rows.length === 0 ? (
              <TableState colSpan={5} text="Select an import job to preview." />
            ) : null}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.rowNumber}</td>
                <td className="font-bold">{row.sku ?? "-"}</td>
                <td>{String(row.normalizedData?.name ?? "-")}</td>
                <td>
                  <StatusPill status={row.validationStatus} />
                </td>
                <td className="max-w-[340px] whitespace-normal">{row.errorMessage ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
        compact ? "" : "flex items-center justify-between gap-3 border-b border-border p-4"
      }
    >
      <h2 className="m-0 text-lg font-bold">{title}</h2>
      <span className="text-sm font-bold text-muted">{count} rows</span>
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
  const tone =
    status === "VALID" || status === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "INVALID" || status === "REJECTED" || status === "FAILED"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${tone}`}>
      {status}
    </span>
  );
}

function messageFromError(error: Error) {
  return error.message || "Request failed";
}
