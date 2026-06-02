import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { Branch, CreateBranchBody, UpdateBranchBody } from "@stockflow/shared";

export function BranchesAdmin() {
  const queryClient = useQueryClient();
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Query
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiRequest<Branch[]>("/branches"),
  });

  const branches = branchesQuery.data ?? [];

  // Mutations
  const createBranchMutation = useMutation({
    mutationFn: (body: CreateBranchBody) =>
      apiRequest<Branch>("/branches", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (newBranch) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setFormSuccess(`Branch "${newBranch.code}" created successfully.`);
      resetForm();
    },
    onError: (error: any) => {
      setFormError(error.message || "Failed to create branch");
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBranchBody }) =>
      apiRequest<Branch>(`/branches/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (updatedBranch) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setFormSuccess(`Branch "${updatedBranch.code}" updated successfully.`);
      resetForm();
    },
    onError: (error: any) => {
      setFormError(error.message || "Failed to update branch");
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/branches/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setFormSuccess("Branch deleted (or deactivated if it had history) successfully.");
    },
    onError: (error: any) => {
      setFormError(error.message || "Failed to delete branch");
    },
  });

  const resetForm = () => {
    setEditingBranch(null);
    setCode("");
    setName("");
    setAddress("");
    setStatus("ACTIVE");
    setFormError(null);
  };

  const handleEditClick = (branch: Branch) => {
    setEditingBranch(branch);
    setCode(branch.code);
    setName(branch.name);
    setAddress(branch.address || "");
    setStatus(branch.status);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const codeTrimmed = code.trim().toUpperCase();
    if (codeTrimmed.length < 2) {
      setFormError("Branch code must be at least 2 characters long.");
      return;
    }

    if (editingBranch) {
      updateBranchMutation.mutate({
        id: editingBranch.id,
        body: {
          name: name.trim(),
          address: address.trim() || undefined,
          status: status as any,
        },
      });
    } else {
      createBranchMutation.mutate({
        code: codeTrimmed,
        name: name.trim(),
        address: address.trim() || undefined,
      });
    }
  };

  const handleDeleteClick = (branch: Branch) => {
    if (confirm(`Are you sure you want to remove branch "${branch.code}"?`)) {
      setFormError(null);
      setFormSuccess(null);
      deleteBranchMutation.mutate(branch.id);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(branches.length / pageSize);
  const paginatedBranches = branches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isPending =
    createBranchMutation.isPending ||
    updateBranchMutation.isPending ||
    deleteBranchMutation.isPending;

  return (
    <section className="grid gap-5 lg:grid-cols-[340px_1fr] animate-rise-in-delay-1">
      {/* Form Sidebar */}
      <form className="surface grid h-fit gap-5 p-5" onSubmit={handleSubmit}>
        <div>
          <p className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Branch Operations
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {editingBranch ? "Edit Branch Info" : "Create New Branch"}
          </h2>
        </div>

        {formSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
            {formSuccess}
          </div>
        )}

        {formError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
            {formError}
          </div>
        )}

        <label className="field">
          <span>Branch Code</span>
          <input
            className="input uppercase"
            disabled={!!editingBranch}
            maxLength={10}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. HCM01"
            required
            type="text"
            value={code}
          />
        </label>

        <label className="field">
          <span>Branch Name</span>
          <input
            className="input"
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ho Chi Minh Office"
            required
            type="text"
            value={name}
          />
        </label>

        <label className="field">
          <span>Address</span>
          <textarea
            className="input min-h-20"
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Nguyen Hue Street, District 1"
            value={address}
          />
        </label>

        {editingBranch && (
          <label className="field">
            <span>Branch Status</span>
            <select className="input" onChange={(e) => setStatus(e.target.value)} value={status}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </label>
        )}

        <div className="flex gap-2">
          <button className="button-primary flex-1" disabled={isPending} type="submit">
            {isPending ? "Saving..." : editingBranch ? "Update Branch" : "Create Branch"}
          </button>
          {editingBranch && (
            <button className="button-secondary" onClick={resetForm} type="button">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Branches Table */}
      <div className="grid gap-4">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
            <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
              Branch Directory
            </h2>
            <span className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
              {branches.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch Code</th>
                  <th>Branch Name</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {branchesQuery.isLoading && (
                  <tr>
                    <td className="py-12 text-center text-sm text-slate-400" colSpan={5}>
                      Loading branches data...
                    </td>
                  </tr>
                )}
                {!branchesQuery.isLoading && branches.length === 0 && (
                  <tr>
                    <td className="py-12 text-center text-sm text-slate-400" colSpan={5}>
                      No branches configured.
                    </td>
                  </tr>
                )}
                {!branchesQuery.isLoading &&
                  paginatedBranches.map((branchItem) => (
                    <tr
                      key={branchItem.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10"
                    >
                      <td className="font-semibold text-slate-900 dark:text-white">
                        <span className="inline-flex rounded-md border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {branchItem.code}
                        </span>
                      </td>
                      <td className="text-slate-800 dark:text-slate-200 font-medium">
                        {branchItem.name}
                      </td>
                      <td className="text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate">
                        {branchItem.address || "-"}
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-md border px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${
                            branchItem.status === "ACTIVE"
                              ? "border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : "border-rose-200/70 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}
                        >
                          {branchItem.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            onClick={() => handleEditClick(branchItem)}
                            title="Edit Branch"
                            type="button"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <button
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                            onClick={() => handleDeleteClick(branchItem)}
                            title="Delete Branch"
                            type="button"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 p-4">
              <button
                className="button-secondary min-h-8 px-2.5 py-1 text-xs"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((c) => Math.max(c - 1, 1))}
                type="button"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="button-secondary min-h-8 px-2.5 py-1 text-xs"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((c) => Math.min(c + 1, totalPages))}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
