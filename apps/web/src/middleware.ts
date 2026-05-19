import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { TOKEN_COOKIE } from "@/lib/auth";

/** Routes that work without a session (login UI lives on `/`). */
const PUBLIC_PATHS = ["/", "/login", "/skift-adgangskode"];

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
  if (pathname === "/api/health") return true;
  if (isAuthApiPath(pathname)) return true;
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

function handleJwtSession(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  if (isAuthApiPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Option A: do not block app routes here — API allows GET while must_change_password;
  // login flow redirects to /skift-adgangskode; mutations return 403 and client redirects.

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isPublic) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
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
