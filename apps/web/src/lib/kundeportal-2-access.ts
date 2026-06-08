import { resolveUserRole, resolveUserRoles } from "@/lib/auth";
import type { User } from "@/types/user";

/** Alle indloggede brugere kan aabne Kundeportal #2. */
export function canAccessKundeportal2(user: User | null): boolean {
  return user !== null;
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