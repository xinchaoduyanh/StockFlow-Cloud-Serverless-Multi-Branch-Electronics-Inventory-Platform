import { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  branchId: string | null;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  branchId: string | null;
};
