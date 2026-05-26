import type { UserRole } from "@stockflow/shared";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  branchId: string | null;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
