import { z } from "zod";

export const loginBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export const registerBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1),
  fullName: z.string().trim().nullable().optional(),
  role: z.string().optional(),
  branchId: z.string().uuid().nullable().optional(),
});

export const adminCreateUserSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  fullName: z.string().trim().min(1).max(255),
  role: z.enum(["ADMIN", "STORE_MANAGER", "WAREHOUSE"]),
  branchId: z.string().uuid().nullable().optional(),
});

export const adminUpdateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(255).optional(),
  role: z.enum(["ADMIN", "STORE_MANAGER", "WAREHOUSE"]).optional(),
  branchId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type AdminCreateUserBody = z.infer<typeof adminCreateUserSchema>;
export type AdminUpdateUserBody = z.infer<typeof adminUpdateUserSchema>;

// Output DTOs
export interface UserDTO {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  branchId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDTO;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
