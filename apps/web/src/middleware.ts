import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { TOKEN_COOKIE } from "@/lib/auth";
import { isPasswordChangeExemptPath } from "@/lib/must-change-password";

/** Routes that work without a session (login UI lives on `/` and `/portal`). */
function isPublicAppPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/portal") return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (isPasswordChangeExemptPath(pathname)) return true;
  return false;
}

const BASIC_AUTH_REALM = "Secure Area";

/**
 * Staging lock via HTTP Basic Auth. Only active when BOTH env vars are set;
 * otherwise this layer is skipped so production/demo JWT login works unchanged.
 */
function isBasicAuthEnabled(): boolean {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  return Boolean(user && password);
}

/** BFF auth routes must run without a session (login, logout, change-password). */
function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/auth/");
}

/** Browser API proxy — must return JSON 401, not redirect to login HTML. */
function isProxyApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/proxy/");
}

/** Health probes — must not redirect to login HTML. */
function isHealthApiPath(pathname: string): boolean {
  return pathname === "/api/health" || pathname === "/api/backend-health";
}

/** Public files from `public/` (logos, icons) — must not require JWT or Basic Auth. */
function isStaticPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/images/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

/** Paths that must never receive a Basic Auth challenge (static + health probe). */
function isBasicAuthExcluded(pathname: string): boolean {
  if (isStaticPublicAsset(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (isHealthApiPath(pathname)) return true;
  if (isAuthApiPath(pathname)) return true;
  // JWT BFF proxy — Basic Auth on fetch breaks kanban/ticket mutations (HTML 401).
  if (isProxyApiPath(pathname)) return true;
  return false;
}

/** 401 with browser-native credential popup (WWW-Authenticate). */
function basicAuthUnauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${BASIC_AUTH_REALM}"`,
    },
  });
}

/**
 * Decode `Authorization: Basic <base64>` using atob (Edge-safe).
 * Returns null if header is missing or malformed.
 */
function parseBasicAuthHeader(
  header: string | null,
): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

/** Constant-time string compare to reduce timing leaks on credential check. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Compare submitted credentials to env-configured user/password. */
function verifyBasicAuth(request: NextRequest): boolean {
  const expectedUser = process.env.BASIC_AUTH_USER ?? "";
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD ?? "";
  const parsed = parseBasicAuthHeader(request.headers.get("authorization"));
  if (!parsed) return false;
  return (
    timingSafeEqual(parsed.username, expectedUser) &&
    timingSafeEqual(parsed.password, expectedPassword)
  );
}

function nextWithPathname(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function handleJwtSession(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  if (isAuthApiPath(pathname) || isProxyApiPath(pathname) || isHealthApiPath(pathname)) {
    return nextWithPathname(request);
  }

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return nextWithPathname(request);
  }

  if (isPublicAppPath(pathname)) {
    return nextWithPathname(request);
  }

  if (!token) {
    if (pathname.startsWith("/portal/")) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return nextWithPathname(request);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticPublicAsset(pathname)) {
    return NextResponse.next();
  }

  // Layer 1: optional site-wide Basic Auth (staging lock)
  if (isBasicAuthEnabled() && !isBasicAuthExcluded(pathname)) {
    if (!verifyBasicAuth(request)) {
      return basicAuthUnauthorized();
    }
  }

  // Layer 2: existing JWT cookie session for app routes
  return handleJwtSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except Next internals, favicon, and health probe.
     * Other `/api/*` routes are included so Basic Auth applies to them too.
     */
    "/((?!_next/static|_next/image|_next|favicon.ico|api/health|images/).*)",
  ],
};
