const DEFAULT_ERROR_MESSAGE = "Yêu cầu thất bại";

/** Message shown to the user; falls back when the API returned an empty body. */
export function errorMessage(error: Error, fallback = DEFAULT_ERROR_MESSAGE): string {
  return error.message || fallback;
}
