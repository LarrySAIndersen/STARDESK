import type { User } from "@/types/user";

import { CHANGE_PASSWORD_PATH } from "@/lib/api-errors";

/** True when API/session user must complete first-time password change. */
export function userMustChangePassword(user: User | null | undefined): boolean {
  return Boolean(user?.must_change_password);
}

export { CHANGE_PASSWORD_PATH };

/** Routes reachable while `must_change_password` is set (password change + auth BFF). */
export function isPasswordChangeExemptPath(pathname: string): boolean {
  if (pathname === "/skift-adgangskode" || pathname.startsWith("/skift-adgangskode/")) {
    return true;
  }
  if (pathname.startsWith("/api/auth/")) {
    return true;
  }
  return false;
}
