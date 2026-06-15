import { TOKEN_COOKIE, USER_COOKIE, isStaff, parseUserFromCookie } from "@/lib/auth";
import { buildWorkspaceHref } from "@/lib/workspace-landing/layout-utils";

export const MIN_SIDE_PATH = "/min-side";

export function isMinSidePath(pathname: string): boolean {
  return pathname === MIN_SIDE_PATH || pathname.startsWith(`${MIN_SIDE_PATH}/`);
}

/**
 * Legacy `/min-side` URL — staff land in personal Arbejdsrum; portal users on home.
 * Returns null when middleware should defer to the RSC page (token without user cookie).
 */
export function resolveMinSideRedirectTarget(
  pathname: string,
  token: string | undefined,
  userCookieRaw: string | undefined,
): string | null {
  if (!isMinSidePath(pathname)) {
    return null;
  }
  if (!token) {
    return "/";
  }
  const user = parseUserFromCookie(userCookieRaw);
  if (!user) {
    return null;
  }
  if (isStaff(user)) {
    return buildWorkspaceHref({ space: "personal", view: "grid" });
  }
  return "/";
}

export function readMinSideRedirectCookies(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): { token?: string; userCookieRaw?: string } {
  return {
    token: request.cookies.get(TOKEN_COOKIE)?.value,
    userCookieRaw: request.cookies.get(USER_COOKIE)?.value,
  };
}
