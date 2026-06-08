import { isAdmin, resolveUserRole, resolveUserRoles } from "@/lib/auth";
import type { User } from "@/types/user";

/** Brugere med rettighedsgruppen kundeportal_2 (eller admin/supporter til test). */
export function canAccessKundeportal2(user: User | null): boolean {
  if (!user) {
    return false;
  }
  if (resolveUserRoles(user).includes("kundeportal_2")) {
    return true;
  }
  const roles = resolveUserRoles(user);
  return (
    isAdmin(user) ||
    roles.includes("supporter")
  );
}

export function kundeportal2RoleLabel(user: User): string {
  if (resolveUserRoles(user).includes("kundeportal_2")) {
    return "Kundeportal #2";
  }
  const role = resolveUserRole(user);
  if (role === "end_user") {
    return "Borger";
  }
  return user.role_label || "Bruger";
}