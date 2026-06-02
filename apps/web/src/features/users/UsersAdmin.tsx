import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserRole } from "@stockflow/shared";
import type { UserDTO, Branch, AdminCreateUserBody, AdminUpdateUserBody } from "@stockflow/shared";
import { apiRequest } from "@/lib/api-client";

// Status constants for frontend usage
const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export function UsersAdmin() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("WAREHOUSE");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Queries
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest<UserDTO[]>("/users"),
  });

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiRequest<Branch[]>("/branches"),
  });

  const users = usersQuery.data ?? [];
  const branches = branchesQuery.data ?? [];

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (body: AdminCreateUserBody) =>
      apiRequest<UserDTO>("/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setFormSuccess(`User ${newUser.email} created and Cognito invitation sent.`);
      resetForm();
    },
    onError: (error: any) => {
      setFormError(error.message || "Failed to create user");
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminUpdateUserBody }) =>
      apiRequest<UserDTO>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setFormSuccess(`User ${updatedUser.email} updated successfully.`);
      resetForm();
    },
    onError: (error: any) => {
      setFormError(error.message || "Failed to update user");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/users/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setFormSuccess("User deleted (or deactivated if they have history) successfully.");
    },
    onError: (error: any) => {
      setFormError(error.message || "Failed to delete user");
    },
  });

  const resetForm = () => {
    setEditingUser(null);
    setEmail("");
    setFullName("");
    setRole("WAREHOUSE");
    setBranchId("");
    setStatus("ACTIVE");
    setFormError(null);
  };

  const handleEditClick = (user: UserDTO) => {
    setEditingUser(user);
    setEmail(user.email);
    setFullName(user.fullName || "");
    setRole(user.role as UserRole);
    setBranchId(user.branchId || "");
    setStatus(user.status);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if ((role === "STORE_MANAGER" || role === "WAREHOUSE") && !branchId) {
      setFormError(`Assigned branch is required for ${role} role.`);
      return;
    }

    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        body: {
          fullName,
          role,
          branchId: role === "STORE_MANAGER" || role === "WAREHOUSE" ? branchId : null,
          status: status as any,
        },
      });
    } else {
      createUserMutation.mutate({
        email,
        fullName,
        role,
        branchId: role === "STORE_MANAGER" || role === "WAREHOUSE" ? branchId : null,
      });
    }
  };

  const handleDeleteClick = (user: UserDTO) => {
    if (confirm(`Are you sure you want to remove user "${user.email}"?`)) {
      setFormError(null);
      setFormSuccess(null);
      deleteUserMutation.mutate(user.id);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(users.length / pageSize);
  const paginatedUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getBranchCode = (bId: string | null) => {
    if (!bId) return "-";
    const found = branches.find((b) => b.id === bId);
    return found ? found.code : "-";
  };

  const isPending =
    createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;

  return (
    <section className="grid gap-5 lg:grid-cols-[340px_1fr] animate-rise-in-delay-1">
      {/* Form Sidebar */}
      <form className="surface grid h-fit gap-5 p-5" onSubmit={handleSubmit}>
        <div>
          <p className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            User Provisioning
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {editingUser ? "Edit User Account" : "Invite New User"}
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
          <span>Email Address</span>
          <input
            className="input"
            disabled={!!editingUser}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="field">
          <span>Full Name</span>
          <input
            className="input"
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            required
            type="text"
            value={fullName}
          />
        </label>

        <label className="field">
          <span>Access Role</span>
          <select
            className="input"
            onChange={(e) => {
              const val = e.target.value as UserRole;
              setRole(val);
              if (val !== "STORE_MANAGER" && val !== "WAREHOUSE") {
                setBranchId("");
              }
            }}
            value={role}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="STORE_MANAGER">STORE_MANAGER</option>
            <option value="WAREHOUSE">WAREHOUSE</option>
          </select>
        </label>

        {(role === "STORE_MANAGER" || role === "WAREHOUSE") && (
          <label className="field">
            <span>Assigned Branch</span>
            <select
              className="input"
              onChange={(e) => setBranchId(e.target.value)}
              required
              value={branchId}
            >
              <option value="">Select branch...</option>
              {branches
                .filter((b) => b.status === "ACTIVE")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        {editingUser && (
          <label className="field">
            <span>Account Status</span>
            <select className="input" onChange={(e) => setStatus(e.target.value)} value={status}>
              <option value={UserStatus.ACTIVE}>ACTIVE (Enabled)</option>
              <option value={UserStatus.INACTIVE}>INACTIVE (Disabled)</option>
            </select>
          </label>
        )}

        <div className="flex gap-2">
          <button className="button-primary flex-1" disabled={isPending} type="submit">
            {isPending ? "Saving..." : editingUser ? "Update User" : "Send Invite"}
          </button>
          {editingUser && (
            <button className="button-secondary" onClick={resetForm} type="button">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Users Table */}
      <div className="grid gap-4">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
            <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
              User Directories
            </h2>
            <span className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
              {users.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Access Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.isLoading && (
                  <tr>
                    <td className="py-12 text-center text-sm text-slate-400" colSpan={6}>
                      Loading user data...
                    </td>
                  </tr>
                )}
                {!usersQuery.isLoading && users.length === 0 && (
                  <tr>
                    <td className="py-12 text-center text-sm text-slate-400" colSpan={6}>
                      No users configured.
                    </td>
                  </tr>
                )}
                {!usersQuery.isLoading &&
                  paginatedUsers.map((userItem) => (
                    <tr
                      key={userItem.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10"
                    >
                      <td className="font-medium text-slate-900 dark:text-white">
                        {userItem.fullName || "-"}
                      </td>
                      <td className="text-slate-600 dark:text-slate-400">{userItem.email}</td>
                      <td>
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-medium tracking-[0.08em] uppercase ${
                            userItem.role === "ADMIN"
                              ? "border-purple-200/70 bg-purple-50 text-purple-800 dark:border-purple-900/30 dark:bg-purple-950/20 dark:text-purple-400"
                              : userItem.role === "STORE_MANAGER"
                                ? "border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
                                : "border-slate-200/70 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350"
                          }`}
                        >
                          {userItem.role}
                        </span>
                      </td>
                      <td>
                        {userItem.role === "STORE_MANAGER" || userItem.role === "WAREHOUSE" ? (
                          <span className="inline-flex rounded-md border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">
                            {getBranchCode(userItem.branchId)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Global</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-md border px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${
                            userItem.status === UserStatus.ACTIVE
                              ? "border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : "border-rose-200/70 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}
                        >
                          {userItem.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            onClick={() => handleEditClick(userItem)}
                            title="Edit User"
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
                            onClick={() => handleDeleteClick(userItem)}
                            title="Delete User"
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
