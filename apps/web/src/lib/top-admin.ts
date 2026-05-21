import type { User } from "@/types/user";

import { resolveUserRole } from "@/lib/auth";

/** Must match API `SOLE_TOP_ADMIN_EMAIL` / `top_admin_policy.py`. */
export const SOLE_TOP_ADMIN_EMAIL = "larrysanders@example.dk";

export function isSoleTopAdminEmail(email: string | undefined | null): boolean {
  if (!email) {
    return false;
  }
  return email.toLowerCase().trim() === SOLE_TOP_ADMIN_EMAIL;
}

/** Top admin UI + sidebar visibility controls (role or reserved owner email). */
export function canManageNavVisibility(user: User | null): boolean {
  if (!user) {
    return false;
  }
  if (isSoleTopAdminEmail(user.email)) {
    return true;
  }
  return resolveUserRole(user) === "top_admin";
}
