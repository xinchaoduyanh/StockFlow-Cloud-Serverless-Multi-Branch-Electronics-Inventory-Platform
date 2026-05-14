export type UserRole = "STORE_MANAGER" | "WAREHOUSE" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  branchId: string | null;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};
