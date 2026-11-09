export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  if (error && typeof error === "object" && "detail" in error && typeof error.detail === "string") {
    return error.detail;
  }
  return fallback;
}
