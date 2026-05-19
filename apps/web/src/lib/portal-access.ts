import { resolveUserRole } from "@/lib/auth";
import type { User } from "@/types/user";

/** Borger-facing role label in portal chrome (not staff ITSM titles). */
export function portalRoleLabel(user: User): string {
  const role = resolveUserRole(user);
  if (role === "end_user") {
    return "Borger";
  }
  const label = `${user.role_label ?? ""}`.toLowerCase();
  if (label.includes("ekstern") || label.includes("external") || label.includes("slutbruger")) {
    return "Borger";
  }
  if (role === "agent") {
    return "Sagsbehandler";
  }
  if (role === "admin" || role === "top_admin") {
    return user.role_label || "Administrator";
  }
  return user.role_label || "Bruger";
}

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
