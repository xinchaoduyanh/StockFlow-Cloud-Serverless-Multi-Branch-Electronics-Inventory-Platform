import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { UserRole } from "@stockflow/shared";
import type {
  UserDTO,
  Branch,
  AdminCreateUserBody,
  AdminUpdateUserBody,
  Paginated,
} from "@stockflow/shared";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { Pagination } from "@/components/table/Pagination";
import { RowActions } from "@/components/table/RowActions";
import { StatusBadge } from "@/components/table/StatusBadge";
import { TableHeader, TableState } from "@/components/table/TablePieces";
import { isBranchBoundRole, toUserRole, USER_ROLE_LABELS } from "@/features/auth/role-labels";

export function UsersAdmin() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [userPendingDelete, setUserPendingDelete] = useState<UserDTO | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.WAREHOUSE);
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const usersQuery = useQuery({
    queryKey: ["users", currentPage],
    queryFn: () =>
      apiRequest<Paginated<UserDTO>>(`/users?page=${currentPage}&limit=${TABLE_PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  });

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiRequest<Branch[]>("/branches"),
  });

  const users = usersQuery.data?.items ?? [];
  const totalUsers = usersQuery.data?.total ?? 0;
  const totalPages = Math.ceil(totalUsers / TABLE_PAGE_SIZE);
  const branches = branchesQuery.data ?? [];

  // Deleting the last row of the last page would otherwise leave an empty page on screen.
  useEffect(() => {
    if (currentPage > 1 && totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const createUserMutation = useMutation({
    mutationFn: (body: AdminCreateUserBody) =>
      apiRequest<UserDTO>("/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (newUser) => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      resetForm();
      setFormSuccess(`Tài khoản ${newUser.email} đã được tạo và email mời kích hoạt đã được gửi.`);
    },
    onError: (error) => setFormError(errorMessage(error, "Không thể tạo tài khoản")),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminUpdateUserBody }) =>
      apiRequest<UserDTO>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (updatedUser) => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      resetForm();
      setFormSuccess(`Cập nhật tài khoản ${updatedUser.email} thành công.`);
    },
    onError: (error) => setFormError(errorMessage(error, "Không thể cập nhật tài khoản")),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setFormSuccess(
        "Đã xóa tài khoản (hoặc vô hiệu hóa nếu tài khoản có lịch sử hoạt động) thành công.",
      );
    },
    onError: (error) => setFormError(errorMessage(error, "Không thể xóa tài khoản")),
  });

  function resetForm() {
    setEditingUser(null);
    setEmail("");
    setFullName("");
    setRole(UserRole.WAREHOUSE);
    setBranchId("");
    setStatus("ACTIVE");
    setFormError(null);
    setFormSuccess(null);
  }

  function startEditing(user: UserDTO) {
    setEditingUser(user);
    setEmail(user.email);
    setFullName(user.fullName ?? "");
    setRole(toUserRole(user.role));
    setBranchId(user.branchId ?? "");
    setStatus(user.status);
    setFormError(null);
    setFormSuccess(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const needsBranch = isBranchBoundRole(role);
    if (needsBranch && !branchId) {
      setFormError(`Chi nhánh trực thuộc là bắt buộc đối với vai trò ${USER_ROLE_LABELS[role]}.`);
      return;
    }
    const resolvedBranchId = needsBranch ? branchId : null;

    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        body: {
          fullName,
          role,
          branchId: resolvedBranchId,
          status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        },
      });
      return;
    }
    createUserMutation.mutate({ email, fullName, role, branchId: resolvedBranchId });
  }

  function confirmDelete() {
    if (!userPendingDelete) return;
    setFormError(null);
    setFormSuccess(null);
    deleteUserMutation.mutate(userPendingDelete.id);
    setUserPendingDelete(null);
  }

  function getBranchCode(id: string | null) {
    return branches.find((branch) => branch.id === id)?.code ?? "Chưa gán";
  }

  const isPending =
    createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;

  return (
    <section className="grid gap-5 lg:grid-cols-[340px_1fr] animate-rise-in-delay-1">
      <form className="surface grid h-fit gap-5 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <p className="m-0 text-xs text-[var(--color-text-muted)]">Quản trị nhân viên</p>
          <h2 className="m-0 font-display text-lg font-semibold tracking-tight">
            {editingUser ? "Cập nhật tài khoản" : "Mời nhân viên mới"}
          </h2>
        </div>

        {formSuccess ? <Notice tone="success">{formSuccess}</Notice> : null}
        {formError ? <Notice tone="error">{formError}</Notice> : null}

        <label className="field">
          <span>Email</span>
          <input
            className="input"
            disabled={Boolean(editingUser)}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nhanvien@duyanhshop.vn"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="field">
          <span>Họ và tên</span>
          <input
            className="input"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn An"
            required
            type="text"
            value={fullName}
          />
        </label>

        <label className="field">
          <span>Vai trò</span>
          <select
            className="input"
            onChange={(event) => {
              const nextRole = toUserRole(event.target.value);
              setRole(nextRole);
              if (!isBranchBoundRole(nextRole)) setBranchId("");
            }}
            value={role}
          >
            <option value={UserRole.ADMIN}>Quản trị viên</option>
            <option value={UserRole.STORE_MANAGER}>Quản lý cửa hàng</option>
            <option value={UserRole.WAREHOUSE}>Thủ kho</option>
          </select>
        </label>

        {isBranchBoundRole(role) ? (
          <label className="field">
            <span>Chi nhánh trực thuộc</span>
            <select
              className="input"
              onChange={(event) => setBranchId(event.target.value)}
              required
              value={branchId}
            >
              <option value="">Chọn chi nhánh</option>
              {branches
                .filter((branch) => branch.status === "ACTIVE")
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}

        {editingUser ? (
          <label className="field">
            <span>Trạng thái tài khoản</span>
            <select
              className="input"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động (khóa)</option>
            </select>
          </label>
        ) : null}

        <div className="flex gap-2">
          <button className="button-primary flex-1" disabled={isPending} type="submit">
            {isPending ? "Đang lưu…" : editingUser ? "Cập nhật" : "Gửi lời mời"}
          </button>
          {editingUser ? (
            <button className="button-secondary" onClick={resetForm} type="button">
              Hủy
            </button>
          ) : null}
        </div>
      </form>

      <section className="surface min-w-0 overflow-hidden">
        <TableHeader title="Danh sách nhân viên" count={totalUsers} />

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Chi nhánh</th>
                <th>Trạng thái</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <TableState colSpan={6} text="Đang tải danh sách nhân viên…" />
              ) : null}
              {!usersQuery.isLoading && totalUsers === 0 ? (
                <TableState
                  colSpan={6}
                  text="Chưa có nhân viên nào. Mời người đầu tiên ở khung bên trái."
                />
              ) : null}
              {!usersQuery.isLoading &&
                users.map((userItem) => (
                  <tr key={userItem.id}>
                    <td className="font-medium text-slate-900">
                      {userItem.fullName ?? "Chưa đặt tên"}
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{userItem.email}</td>
                    <td>
                      <span
                        className={`chip font-sans ${
                          userItem.role === UserRole.ADMIN
                            ? "border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]"
                            : ""
                        }`}
                      >
                        {USER_ROLE_LABELS[userItem.role] ?? userItem.role}
                      </span>
                    </td>
                    <td>
                      {isBranchBoundRole(userItem.role) ? (
                        <span className="chip">{getBranchCode(userItem.branchId)}</span>
                      ) : (
                        <span className="text-xs text-slate-500">Tất cả chi nhánh</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={userItem.status} />
                    </td>
                    <td className="text-right">
                      <RowActions
                        deleteLabel={`Xóa ${userItem.email}`}
                        editLabel={`Sửa ${userItem.email}`}
                        onDelete={() => setUserPendingDelete(userItem)}
                        onEdit={() => startEditing(userItem)}
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
          pageSize={TABLE_PAGE_SIZE}
          totalItems={totalUsers}
          totalPages={totalPages}
        />
      </section>

      {userPendingDelete ? (
        <ConfirmDialog
          confirmLabel="Xóa nhân viên"
          description={`Tài khoản ${userPendingDelete.email} sẽ bị xóa, hoặc bị khóa nếu đã có lịch sử hoạt động.`}
          isDestructive
          onCancel={() => setUserPendingDelete(null)}
          onConfirm={confirmDelete}
          title="Xóa nhân viên này?"
        />
      ) : null}
    </section>
  );
}
