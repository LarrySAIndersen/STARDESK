import { canManageNavVisibility } from "@/lib/top-admin";
import type { User, UserRole } from "@/types/user";

export const TOKEN_COOKIE = "stardesk_token";
export const USER_COOKIE = "stardesk_user";

/** Map cookie / API role strings to canonical DB roles. */
export function normalizeUserRole(role: string | undefined): UserRole | null {
  if (!role) {
    return null;
  }
  const key = role.trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "top_admin" || key === "topadministrator") {
    return "top_admin";
  }
  if (key === "admin" || key === "administrator") {
    return "admin";
  }
  if (key === "agent") {
    return "agent";
  }
  if (key === "end_user" || key === "slutbruger") {
    return "end_user";
  }
  if (key === "supporter") {
    return "supporter";
  }
  if (key === "stardesk_reviewer" || key === "stardesk reviewer") {
    return "stardesk_reviewer";
  }
  if (key === "kundeportal_2" || key === "kundeportal #2" || key === "kundeportal 2") {
    return "kundeportal_2";
  }
  return null;
}

const ROLE_PRIORITY: UserRole[] = [
  "top_admin",
  "admin",
  "supporter",
  "agent",
  "kundeportal_2",
  "stardesk_reviewer",
  "end_user",
];

/** Resolve canonical role from `role` and Danish `role_label`. */
export function resolveUserRole(
  user: Pick<User, "role" | "role_label" | "roles">,
): UserRole | string | null {
  const roles = resolveUserRoles(user);
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return (
    normalizeUserRole(user.role) ??
    normalizeUserRole(user.role_label) ??
    user.role ??
    null
  );
}

/** Resolve all assigned roles; falls back to legacy single `role`. */
export function resolveUserRoles(user: Pick<User, "role" | "role_label" | "roles">): UserRole[] {
  const fromArray = (user.roles ?? [])
    .map((role) => normalizeUserRole(role))
    .filter((role): role is UserRole => role !== null);
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  const single = normalizeUserRole(user.role) ?? normalizeUserRole(user.role_label);
  return single ? [single] : [];
}

function roleLabelIndicatesAdmin(roleLabel: string | undefined): boolean {
  const label = roleLabel?.trim().toLowerCase() ?? "";
  if (!label) {
    return false;
  }
  return label.includes("administrator") || label.includes("topadministrator");
}

function coerceParsedUser(parsed: User): User | null {
  if (!parsed?.email) {
    return null;
  }
  const parsedRoles = Array.isArray(parsed.roles)
    ? parsed.roles
        .map((role) => normalizeUserRole(String(role)))
        .filter((role): role is UserRole => role !== null)
    : [];
  const role =
    normalizeUserRole(parsed.role) ??
    parsedRoles[0] ??
    parsed.role;
  const roles = parsedRoles.length > 0 ? parsedRoles : role ? [role as UserRole] : undefined;
  const roleLabels = Array.isArray(parsed.role_labels)
    ? parsed.role_labels.map(String)
    : undefined;
  return {
    ...parsed,
    role,
    roles,
    role_labels: roleLabels,
    must_change_password: Boolean(parsed.must_change_password),
    password_policy_exempt: Boolean(parsed.password_policy_exempt),
  };
}

/** Parse `stardesk_user` from server cookies or `document.cookie` (encoded or plain JSON). */
export function parseUserFromCookie(raw: string | undefined | null): User | null {
  if (!raw) {
    return null;
  }
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // keep raw only
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as User;
      const user = coerceParsedUser(parsed);
      if (user) {
        return user;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

let clientSessionCache: User | null = null;

/** In-memory display cache after `/api/auth/session` (roles come from API only). */
export function setClientSessionCache(user: User | null) {
  clientSessionCache = user;
}

/** Fetch session from BFF (HttpOnly cookies). Call once on client mount where needed. */
export async function hydrateClientSession(): Promise<User | null> {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      clientSessionCache = null;
      return null;
    }
    const body = (await response.json()) as { user?: User };
    clientSessionCache = body.user ?? null;
    return clientSessionCache;
  } catch {
    clientSessionCache = null;
    return null;
  }
}

/** @deprecated Token is HttpOnly — always null in the browser. */
export function getClientToken(): string | null {
  return null;
}

/** Best-effort client user from hydrated cache; prefer `serverUser` props when available. */
export function getClientUser(): User | null {
  return clientSessionCache;
}

/** @deprecated Server sets HttpOnly cookies on login — use cache hydrate after profile API. */
export function writeUserCookie(user: User) {
  setClientSessionCache(user);
}

export async function clearSession() {
  clientSessionCache = null;
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // ignore
    }
  }
}

export function isStaff(user: User | null): boolean {
  if (!user) {
    return false;
  }
  const roles = resolveUserRoles(user);
  return roles.some(
    (role) =>
      role === "agent" ||
      role === "admin" ||
      role === "top_admin" ||
      role === "supporter",
  );
}

export function isTopAdmin(user: User | null): boolean {
  return canManageNavVisibility(user);
}

export function isAdmin(user: User | null): boolean {
  if (!user) {
    return false;
  }
  const roles = resolveUserRoles(user);
  if (roles.some((role) => role === "admin" || role === "top_admin")) {
    return true;
  }
  if (user.role_labels?.some(roleLabelIndicatesAdmin)) {
    return true;
  }
  return roleLabelIndicatesAdmin(user.role_label);
}

export function canManageUsers(user: User | null): boolean {
  return isAdmin(user);
}

export function canExportTickets(user: User | null): boolean {
  return isStaff(user);
}

export function isSubmitter(user: User | null): boolean {
  if (!user) {
    return false;
  }
  return resolveUserRoles(user).includes("end_user");
}

export function isStardeskReviewer(user: User | null): boolean {
  if (!user) {
    return false;
  }
  return resolveUserRoles(user).includes("stardesk_reviewer");
}

/** Staff or Stardesk Reviewer — agent shell and browse access. */
export function hasAgentShellAccess(user: User | null): boolean {
  return isStaff(user) || isStardeskReviewer(user);
}

/** Staff-only Forbedringer tab (reviewers create notes on pages). */
export function canViewImprovements(user: User | null): boolean {
  return isStaff(user);
}
