import {
  clearAllTokens,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
} from "./auth-token";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

type RequestOptions = RequestInit & {
  auth?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

async function executeRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Refresh failed");
    }

    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    setAuthToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data.accessToken;
  } catch {
    clearAllTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }
}

async function refreshAuthToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = executeRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  { auth = true, headers, ...options }: RequestOptions = {},
): Promise<T> {
  const token = auth ? getAuthToken() : null;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (response.status === 401 && auth) {
    const newToken = await refreshAuthToken();
    if (newToken) {
      const retryResponse = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          ...headers,
        },
      });

      if (!retryResponse.ok) {
        const message = await retryResponse.text();
        throw new Error(message || `Request failed with status ${retryResponse.status}`);
      }

      return (await retryResponse.json()) as T;
    } else {
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
