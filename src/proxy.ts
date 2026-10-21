import { type NextRequest, NextResponse } from "next/server";

import { SESSION_TOKEN_PATTERN } from "@/modules/auth/tokens";
import { sessionCookieName, sessionCookieOptions } from "@/server/auth/cookie";

/** Everything else requires a session. */
const PUBLIC_PATHS = new Set(["/login", "/api/health"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function jsonError(status: number, error: string) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Optimistic route protection: rejects requests without a well-formed session
 * cookie before any rendering happens. The authoritative check against the
 * database happens in the data access layer (`requireSession()`).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const api = isApiPath(pathname);
  const safeMethod = SAFE_METHODS.has(request.method);

  // CSRF defense for API routes; Server Actions have Next.js' own origin check.
  if (api && !safeMethod && !isSameOrigin(request))
    return jsonError(403, "forbidden");

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const cookieName = sessionCookieName();
  const token = request.cookies.get(cookieName)?.value;
  if (!token || !SESSION_TOKEN_PATTERN.test(token)) {
    if (api || !safeMethod) return jsonError(401, "unauthorized");
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    if (pathname !== "/")
      login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
  // Sliding cookie lifetime; the server-side expiry is extended in the DAL.
  if (request.method === "GET" && !api) {
    response.cookies.set(cookieName, token, sessionCookieOptions());
  }
  return response;
}

export const config = {
  // Static assets and the app icons stay public (the login page shows them).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)",
  ],
};
