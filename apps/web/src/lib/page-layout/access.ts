import { isAdmin, resolveUserRole } from "@/lib/auth";
import { canManageNavVisibility, isSoleTopAdminEmail } from "@/lib/top-admin";
import type { User } from "@/types/user";

/** Who may use page layout design mode (top bar + field chrome). */
export function canEditPageLayout(user: User | null): boolean {
  if (!user) {
    return false;
  }
  if (isSoleTopAdminEmail(user.email) || canManageNavVisibility(user)) {
    return true;
  }
  if (isAdmin(user)) {
    return true;
  }
  const role = resolveUserRole(user);
  return role === "top_admin" || role === "admin";
}
