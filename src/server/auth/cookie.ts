import { SESSION_TTL_MS } from "@/modules/auth/sessions";

/**
 * Secure cookies require HTTPS (browsers make an exception for localhost).
 * `ALLOW_INSECURE_LAN_HTTP=true` opts out for plain HTTP in a trusted LAN.
 */
export function secureCookiesEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_INSECURE_LAN_HTTP !== "true"
  );
}

/** `__Host-` binds the cookie to this exact host and path `/`, but requires `Secure`. */
export function sessionCookieName(
  secure: boolean = secureCookiesEnabled(),
): string {
  return secure ? "__Host-cm_session" : "cm_session";
}

export function sessionCookieOptions(secure: boolean = secureCookiesEnabled()) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/**
 * Whether the browser will drop a `Secure` cookie set on this request: plain
 * HTTP to anything but a loopback name (which browsers treat as secure).
 */
export function secureCookieRejected(
  host: string | null,
  forwardedProto: string | null,
  secure: boolean = secureCookiesEnabled(),
): boolean {
  if (!secure || !host) return false;
  if (forwardedProto?.split(",")[0]?.trim().toLowerCase() === "https") {
    return false;
  }
  const name = host
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  const loopback =
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "::1" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name);
  return !loopback;
}
