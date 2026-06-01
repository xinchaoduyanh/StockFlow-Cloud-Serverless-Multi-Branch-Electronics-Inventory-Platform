"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearAllTokens, getAuthToken, setAuthToken } from "@/lib/auth-token";
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
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { loginWithCognito } = await import("@/lib/cognito");
      const token = await loginWithCognito(input.email, input.password);
      // Once successfully authenticated via Cognito, retrieve the mapped local user profile from backend
      const user = await getCurrentUser();
      return { user, accessToken: token };
    },
    onSuccess: (data) => {
      if (data.accessToken) {
        setAuthToken(data.accessToken);
      }
      queryClient.setQueryData(currentUserQueryKey, data.user);
      router.replace("/dashboard");
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
