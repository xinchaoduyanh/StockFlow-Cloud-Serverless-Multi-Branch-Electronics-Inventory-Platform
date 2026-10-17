import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { Branch, CreateBranchBody, UpdateBranchBody } from "@stockflow/shared";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { Pagination } from "@/components/table/Pagination";
import { RowActions } from "@/components/table/RowActions";
import { StatusBadge } from "@/components/table/StatusBadge";
import { TableHeader, TableState } from "@/components/table/TablePieces";

const PAGE_SIZE = 8;
const MIN_BRANCH_CODE_LENGTH = 2;

function errorMessage(error: Error, fallback: string) {
  return error.message || fallback;
}

export function BranchesAdmin() {
  const queryClient = useQueryClient();
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchPendingDelete, setBranchPendingDelete] = useState<Branch | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiRequest<Branch[]>("/branches"),
  });

  const branches = branchesQuery.data ?? [];

  const createBranchMutation = useMutation({
    mutationFn: (body: CreateBranchBody) =>
      apiRequest<Branch>("/branches", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (newBranch) => {
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      resetForm();
      setFormSuccess(`Chi nhánh ${newBranch.code} đã được tạo.`);
    },
    onError: (error) => setFormError(errorMessage(error, "Không thể tạo chi nhánh")),
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBranchBody }) =>
      apiRequest<Branch>(`/branches/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (updatedBranch) => {
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      resetForm();
      setFormSuccess(`Chi nhánh ${updatedBranch.code} đã được cập nhật.`);
    },
    onError: (error) => setFormError(errorMessage(error, "Không thể cập nhật chi nhánh")),
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/branches/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      setFormSuccess(
        "Đã xóa chi nhánh (hoặc vô hiệu hóa nếu chi nhánh có lịch sử hoạt động) thành công.",
      );
    },
    onError: (error) => setFormError(errorMessage(error, "Không thể xóa chi nhánh")),
  });

  function resetForm() {
    setEditingBranch(null);
    setCode("");
    setName("");
    setAddress("");
    setStatus("ACTIVE");
    setFormError(null);
    setFormSuccess(null);
  }

  function startEditing(branch: Branch) {
    setEditingBranch(branch);
    setCode(branch.code);
    setName(branch.name);
    setAddress(branch.address ?? "");
    setStatus(branch.status);
    setFormError(null);
    setFormSuccess(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length < MIN_BRANCH_CODE_LENGTH) {
      setFormError(`Mã chi nhánh phải dài ít nhất ${MIN_BRANCH_CODE_LENGTH} ký tự.`);
      return;
    }

    if (editingBranch) {
      updateBranchMutation.mutate({
        id: editingBranch.id,
        body: {
          name: name.trim(),
          address: address.trim() || undefined,
          status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        },
      });
      return;
    }
    createBranchMutation.mutate({
      code: normalizedCode,
      name: name.trim(),
      address: address.trim() || undefined,
    });
  }

  function confirmDelete() {
    if (!branchPendingDelete) return;
    setFormError(null);
    setFormSuccess(null);
    deleteBranchMutation.mutate(branchPendingDelete.id);
    setBranchPendingDelete(null);
  }

  const totalPages = Math.ceil(branches.length / PAGE_SIZE);
  const paginatedBranches = branches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const isPending =
    createBranchMutation.isPending ||
    updateBranchMutation.isPending ||
    deleteBranchMutation.isPending;

  return (
    <section className="grid gap-5 lg:grid-cols-[340px_1fr] animate-rise-in-delay-1">
      <form className="surface grid h-fit gap-5 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <p className="m-0 text-xs text-[var(--color-text-muted)]">Quản trị chi nhánh</p>
          <h2 className="m-0 font-display text-lg font-semibold tracking-tight">
            {editingBranch ? "Cập nhật chi nhánh" : "Thêm chi nhánh"}
          </h2>
        </div>

        {formSuccess ? <Notice tone="success">{formSuccess}</Notice> : null}
        {formError ? <Notice tone="error">{formError}</Notice> : null}

        <label className="field">
          <span>Mã chi nhánh</span>
          <input
            className="input font-mono uppercase"
            disabled={Boolean(editingBranch)}
            maxLength={10}
            onChange={(event) => setCode(event.target.value)}
            placeholder="HCM-Q1"
            required
            type="text"
            value={code}
          />
          <span className="field-hint">Dùng làm nhãn trong bảng tồn kho, tối đa 10 ký tự.</span>
        </label>

        <label className="field">
          <span>Tên chi nhánh</span>
          <input
            className="input"
            onChange={(event) => setName(event.target.value)}
            placeholder="Chi nhánh Quận 1"
            required
            type="text"
            value={name}
          />
        </label>

        <label className="field">
          <span>Địa chỉ</span>
          <textarea
            className="input min-h-20 py-2.5"
            onChange={(event) => setAddress(event.target.value)}
            placeholder="47 Lê Thánh Tôn, Quận 1, TP.HCM"
            value={address}
          />
        </label>

        {editingBranch ? (
          <label className="field">
            <span>Trạng thái</span>
            <select
              className="input"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </label>
        ) : null}

        <div className="flex gap-2">
          <button className="button-primary flex-1" disabled={isPending} type="submit">
            {isPending ? "Đang lưu…" : editingBranch ? "Cập nhật" : "Tạo chi nhánh"}
          </button>
          {editingBranch ? (
            <button className="button-secondary" onClick={resetForm} type="button">
              Hủy
            </button>
          ) : null}
        </div>
      </form>

      <section className="surface min-w-0 overflow-hidden">
        <TableHeader title="Danh sách chi nhánh" count={branches.length} />

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên chi nhánh</th>
                <th>Địa chỉ</th>
                <th>Trạng thái</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {branchesQuery.isLoading ? (
                <TableState colSpan={5} text="Đang tải danh sách chi nhánh…" />
              ) : null}
              {!branchesQuery.isLoading && branches.length === 0 ? (
                <TableState
                  colSpan={5}
                  text="Chưa có chi nhánh nào. Thêm chi nhánh đầu tiên ở khung bên trái."
                />
              ) : null}
              {!branchesQuery.isLoading &&
                paginatedBranches.map((branchItem) => (
                  <tr key={branchItem.id}>
                    <td>
                      <span className="chip">{branchItem.code}</span>
                    </td>
                    <td className="font-medium text-slate-900">{branchItem.name}</td>
                    <td className="max-w-xs truncate text-xs text-slate-500">
                      {branchItem.address ?? "Chưa có địa chỉ"}
                    </td>
                    <td>
                      <StatusBadge status={branchItem.status} />
                    </td>
                    <td className="text-right">
                      <RowActions
                        deleteLabel={`Xóa chi nhánh ${branchItem.code}`}
                        editLabel={`Sửa chi nhánh ${branchItem.code}`}
                        onDelete={() => setBranchPendingDelete(branchItem)}
                        onEdit={() => startEditing(branchItem)}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          pageSize={PAGE_SIZE}
          totalItems={branches.length}
          totalPages={totalPages}
        />
      </section>

      {branchPendingDelete ? (
        <ConfirmDialog
          confirmLabel="Xóa chi nhánh"
          description={`Chi nhánh ${branchPendingDelete.code} sẽ bị xóa, hoặc bị khóa nếu đã có lịch sử hoạt động.`}
          isDestructive
          onCancel={() => setBranchPendingDelete(null)}
          onConfirm={confirmDelete}
          title="Xóa chi nhánh này?"
        />
      ) : null}
    </section>
  );
}
