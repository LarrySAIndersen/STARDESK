/** Routes where the on-page review overlay must not run (admin list / prototypes). */
export function isForbedringerAdminPath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return pathname === "/forbedringer" || pathname.startsWith("/forbedringer/");
}
