import { UserRole } from "@stockflow/shared";

export const USER_ROLE_LABELS: Record<string, string> = {
  [UserRole.ADMIN]: "Quản trị viên",
  [UserRole.STORE_MANAGER]: "Quản lý cửa hàng",
  [UserRole.WAREHOUSE]: "Thủ kho",
};

export function toUserRole(value: string): UserRole {
  if (value === UserRole.ADMIN) return UserRole.ADMIN;
  if (value === UserRole.STORE_MANAGER) return UserRole.STORE_MANAGER;
  return UserRole.WAREHOUSE;
}

/** Store managers and warehouse staff always belong to one branch; admins are global. */
export function isBranchBoundRole(role: string): boolean {
  return role === UserRole.STORE_MANAGER || role === UserRole.WAREHOUSE;
}
