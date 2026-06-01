import { apiRequest } from "@/lib/api-client";
import { AuthUser } from "./types";

export function getCurrentUser() {
  return apiRequest<AuthUser>("/auth/me");
}
