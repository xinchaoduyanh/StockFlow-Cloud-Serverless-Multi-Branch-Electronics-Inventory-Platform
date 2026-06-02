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
      setFormSuccess(`Chi nhánh "${newBranch.code}" đã được tạo thành công.`);
      resetForm();
    },
    onError: (error: any) => {
      setFormError(error.message || "Không thể tạo chi nhánh");
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
      setFormSuccess(`Chi nhánh "${updatedBranch.code}" đã được cập nhật thành công.`);
      resetForm();
    },
    onError: (error: any) => {
      setFormError(error.message || "Không thể cập nhật chi nhánh");
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/branches/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setFormSuccess(
        "Đã xóa chi nhánh (hoặc vô hiệu hóa nếu chi nhánh có lịch sử hoạt động) thành công.",
      );
    },
    onError: (error: any) => {
      setFormError(error.message || "Không thể xóa chi nhánh");
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
      setFormError("Mã chi nhánh phải dài ít nhất 2 ký tự.");
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
    if (confirm(`Bạn có chắc chắn muốn xóa chi nhánh "${branch.code}" không?`)) {
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
            Quản trị Chi nhánh
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {editingBranch ? "Cập nhật chi nhánh" : "Tạo chi nhánh mới"}
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
          <span>Mã chi nhánh</span>
          <input
            className="input uppercase"
            disabled={!!editingBranch}
            maxLength={10}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ví dụ: HCM01"
            required
            type="text"
            value={code}
          />
        </label>

        <label className="field">
          <span>Tên chi nhánh</span>
          <input
            className="input"
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Chi nhánh Hồ Chí Minh"
            required
            type="text"
            value={name}
          />
        </label>

        <label className="field">
          <span>Địa chỉ</span>
          <textarea
            className="input min-h-20"
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ví dụ: 123 Nguyễn Huệ, Quận 1"
            value={address}
          />
        </label>

        {editingBranch && (
          <label className="field">
            <span>Trạng thái chi nhánh</span>
            <select className="input" onChange={(e) => setStatus(e.target.value)} value={status}>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </label>
        )}

        <div className="flex gap-2">
          <button className="button-primary flex-1" disabled={isPending} type="submit">
            {isPending ? "Đang lưu..." : editingBranch ? "Cập nhật" : "Tạo mới"}
          </button>
          {editingBranch && (
            <button className="button-secondary" onClick={resetForm} type="button">
              Hủy bỏ
            </button>
          )}
        </div>
      </form>

      {/* Branches Table */}
      <div className="grid gap-4">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
            <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
              Danh mục Chi nhánh
            </h2>
            <span className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
              Tổng cộng {branches.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã chi nhánh</th>
                  <th>Tên chi nhánh</th>
                  <th>Địa chỉ</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {branchesQuery.isLoading && (
                  <tr>
                    <td className="py-12 text-center text-sm text-slate-400" colSpan={5}>
                      Đang tải dữ liệu chi nhánh...
                    </td>
                  </tr>
                )}
                {!branchesQuery.isLoading && branches.length === 0 && (
                  <tr>
                    <td className="py-12 text-center text-sm text-slate-400" colSpan={5}>
                      Chưa cấu hình chi nhánh nào.
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
                          {branchItem.status === "ACTIVE" ? "ĐANG HOẠT ĐỘNG" : "NGỪNG HOẠT ĐỘNG"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            onClick={() => handleEditClick(branchItem)}
                            title="Chỉnh sửa"
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
                            title="Xóa chi nhánh"
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
                Trước
              </button>
              <span className="text-xs text-slate-500">
                Trang {currentPage} trên {totalPages}
              </span>
              <button
                className="button-secondary min-h-8 px-2.5 py-1 text-xs"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((c) => Math.min(c + 1, totalPages))}
                type="button"
              >
                Sau
              </button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
