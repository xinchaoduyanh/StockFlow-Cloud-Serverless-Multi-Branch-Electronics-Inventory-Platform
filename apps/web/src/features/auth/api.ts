import { apiRequest } from "@/lib/api-client";
import { LoginResponse, AuthUser } from "./types";

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>("/auth/login", {
    auth: false,
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCurrentUser() {
  return apiRequest<AuthUser>("/auth/me");
}
