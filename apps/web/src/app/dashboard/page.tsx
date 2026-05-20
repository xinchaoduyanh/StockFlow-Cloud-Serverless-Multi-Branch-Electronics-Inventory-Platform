"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const { data: user, isLoading, error } = useCurrentUser();
  const logout = useLogout();
  const queryClient = useQueryClient();
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

  const uploadImport = useMutation({
    mutationFn: (formData: FormData) =>
      apiRequest<ImportJob>("/imports/upload", {
        method: "POST",
        body: formData,
      }),
    onSuccess: (job) => {
      setSelectedImportId(job.id);
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
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
  const transferComponents = useMemo(
    () =>
      inventoryItems.filter(
        (item) => !transferForm.fromBranchId || item.branchId === transferForm.fromBranchId,
      ),
    [inventoryItems, transferForm.fromBranchId],
  );

  if (isLoading) {
    return <ShellMessage>Loading...</ShellMessage>;
  }

  if (error || !user) {
    return (
      <ShellMessage>
        <div className="grid gap-4">
          <h1 className="m-0 text-2xl font-bold">Session expired</h1>
          <button className="button-primary w-fit" onClick={logout} type="button">
            Back to login
          </button>
        </div>
      </ShellMessage>
    );
  }

  function handleCreateTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTransfer.mutate();
  }

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file || !importBranchId) {
      return;
    }

    const formData = new FormData();
    formData.append("branchId", importBranchId);
    formData.append("file", file);
    uploadImport.mutate(formData);
    form.reset();
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-[calc(100%_-_48px)] max-w-[1180px] items-center justify-between gap-4 py-5 max-md:w-[calc(100%_-_32px)] max-md:flex-col max-md:items-start">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-accent">StockFlow Cloud</p>
            <h1 className="m-0 text-2xl font-bold">Inventory Operations</h1>
          </div>
          <div className="flex items-center gap-3 text-sm max-md:w-full max-md:justify-between">
            <span className="text-muted">{user.email}</span>
            <span className="rounded-md border border-border px-2 py-1 font-bold">{user.role}</span>
            <button className="button-secondary" onClick={logout} type="button">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-[calc(100%_-_48px)] max-w-[1180px] gap-5 py-6 max-md:w-[calc(100%_-_32px)]">
        <section className="grid gap-4 rounded-lg border border-border bg-white p-4">
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

          <nav className="flex flex-wrap gap-2">
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
              className="grid h-fit gap-4 rounded-lg border border-border bg-white p-4"
              onSubmit={handleUpload}
            >
              <h2 className="m-0 text-lg font-bold">Upload Excel</h2>
              <label className="field">
                <span>Branch</span>
                <select
                  className="input"
                  onChange={(event) => setImportBranchId(event.target.value)}
                  required
                  value={importBranchId}
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
                <span>.xlsx file</span>
                <input
                  className="input file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-white"
                  name="file"
                  required
                  type="file"
                  accept=".xlsx"
                />
              </label>
              {uploadImport.error ? (
                <p className="error-text">{messageFromError(uploadImport.error)}</p>
              ) : null}
              <button className="button-primary" disabled={uploadImport.isPending} type="submit">
                {uploadImport.isPending ? "Uploading..." : "Upload and preview"}
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
