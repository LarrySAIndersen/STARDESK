import type { User } from "@/types/user";

/** Voluntary password change page (no forced first-login redirect). */
export const CHANGE_PASSWORD_PATH = "/skift-adgangskode";

/** True when API/session user must complete first-time password change. */
export function userMustChangePassword(user: User | null | undefined): boolean {
  if (user?.password_policy_exempt) {
    return false;
  }
  return Boolean(user?.must_change_password);
}

/** Normalize user payload before writing `stardesk_user` cookie. */
export function userForSessionCookie(user: User): User {
  return {
    ...user,
    must_change_password: userMustChangePassword(user),
    password_policy_exempt: Boolean(user.password_policy_exempt),
  };
}

/** Routes reachable while `must_change_password` is set (password change + auth BFF). */
export function isPasswordChangeExemptPath(pathname: string): boolean {
  if (pathname === CHANGE_PASSWORD_PATH || pathname.startsWith(`${CHANGE_PASSWORD_PATH}/`)) {
    return true;
  }
  if (pathname.startsWith("/api/auth/")) {
    return true;
  }
  return false;
}
