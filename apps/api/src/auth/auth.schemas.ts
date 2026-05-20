import { z } from "zod";

export const loginBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshBody = z.infer<typeof refreshBodySchema>;
