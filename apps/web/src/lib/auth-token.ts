export const authCookieName = "stockflow_access_token";

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

export function setAuthToken(token: string) {
  document.cookie = `${authCookieName}=${token}; path=/; max-age=86400; SameSite=Lax`;
}

export function clearAuthToken() {
  document.cookie = `${authCookieName}=; path=/; max-age=0; SameSite=Lax`;
}
