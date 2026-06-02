"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAuthToken, setAuthToken } from "@/lib/auth-token";
import { getCurrentUser } from "./api";

export const currentUserQueryKey = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    enabled: Boolean(getAuthToken()),
  });
}

export function useLogin() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { loginWithCognito } = await import("@/lib/cognito");
      return loginWithCognito(input.email, input.password);
    },
    onSuccess: (data) => {
      if (data.accessToken) {
        router.replace("/dashboard");
      }
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return () => {
    import("@/lib/cognito").then(({ logoutCognito }) => {
      logoutCognito();
    });
    queryClient.removeQueries({ queryKey: currentUserQueryKey });
    router.replace("/login");
  };
}
