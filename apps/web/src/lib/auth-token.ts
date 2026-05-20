export const authCookieName = "stockflow_access_token";
export const refreshCookieName = "stockflow_refresh_token";

export function getAuthToken() {
  if (typeof document === "undefined") {
    return null;
  }

  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${authCookieName}=`))
      ?.split("=")[1] ?? null
  );
}

export function getRefreshToken() {
  if (typeof document === "undefined") {
    return null;
  }

  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${refreshCookieName}=`))
      ?.split("=")[1] ?? null
  );
}

export function setAuthToken(token: string) {
  const isProd = process.env.NODE_ENV === "production";
  document.cookie = `${authCookieName}=${token}; path=/; max-age=86400; SameSite=Lax${isProd ? "; Secure" : ""}`;
}

export function setRefreshToken(token: string) {
  const isProd = process.env.NODE_ENV === "production";
  document.cookie = `${refreshCookieName}=${token}; path=/; max-age=604800; SameSite=Lax${isProd ? "; Secure" : ""}`;
}

export function clearAuthToken() {
  document.cookie = `${authCookieName}=; path=/; max-age=0; SameSite=Lax`;
}

export function clearRefreshToken() {
  document.cookie = `${refreshCookieName}=; path=/; max-age=0; SameSite=Lax`;
}

export function clearAllTokens() {
  clearAuthToken();
  clearRefreshToken();
}
