import { resolveUserRole } from "@/lib/auth";
import type { User } from "@/types/user";

/** Slutbruger eller bruger med titel/rolle der indeholder «ekstern». */
export function canAccessPortalKnowledge(user: User | null): boolean {
  if (!user) {
    return false;
  }
  const role = resolveUserRole(user);
  if (role === "end_user") {
    return true;
  }
  const label = `${user.role_label ?? ""} ${user.role ?? ""}`.toLowerCase();
  return label.includes("ekstern") || label.includes("external");
}
