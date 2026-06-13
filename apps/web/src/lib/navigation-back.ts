const LOGIN_PREFIXES = ["/login", "/portal/login"] as const;

/** Fallback when browser history has no in-app entry to return to. */
export function navigationBackFallback(pathname: string): string {
  if (pathname.startsWith("/portal") || pathname.startsWith("/kundeportal-2")) {
    return "/portal";
  }
  if (pathname.startsWith("/classic")) {
    return "/classic";
  }
  return "/";
}

export function shouldShowNavigationBack(pathname: string, canGoBack: boolean): boolean {
  if (!canGoBack) {
    return false;
  }
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return false;
  }
  for (const prefix of LOGIN_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return false;
    }
  }
  return true;
}

export function browserHistoryCanGoBack(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.history.length > 1;
}
