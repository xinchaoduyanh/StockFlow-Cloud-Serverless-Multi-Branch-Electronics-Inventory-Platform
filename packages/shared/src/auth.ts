import { z } from "zod";

export const loginBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export const registerBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8),
  fullName: z.string().trim().nullable().optional(),
  role: z.string().optional(),
  branchId: z.string().uuid().nullable().optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;

// Output DTOs
export interface UserDTO {
  id: string;
  email: string;
  role: string;
  status: string;
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
