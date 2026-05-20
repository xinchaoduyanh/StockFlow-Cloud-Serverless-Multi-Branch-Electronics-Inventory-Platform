"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearAllTokens, getAuthToken, setAuthToken, setRefreshToken } from "@/lib/auth-token";
import { getCurrentUser, login } from "./api";

export const currentUserQueryKey = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    enabled: Boolean(getAuthToken()),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: { email: string; password: string }) => login(input.email, input.password),
    onSuccess: (data) => {
      setAuthToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      queryClient.setQueryData(currentUserQueryKey, data.user);
      router.replace("/dashboard");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return () => {
    clearAllTokens();
    queryClient.removeQueries({ queryKey: currentUserQueryKey });
    router.replace("/login");
  };
}
