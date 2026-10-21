export const DEFAULT_AFTER_LOGIN = "/dashboard";

const INTERNAL_ORIGIN = "http://internal.invalid";

/**
 * Accepts only same-origin, absolute paths as post-login redirect targets
 * (prevents open redirects such as `//evil.example` or `/\evil.example`).
 */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return DEFAULT_AFTER_LOGIN;
  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN || url.pathname === "/login")
      return DEFAULT_AFTER_LOGIN;
    return `${url.pathname}${url.search}`;
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
}
