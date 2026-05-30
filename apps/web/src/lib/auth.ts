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
  return null;
}

/** Resolve canonical role from `role` and Danish `role_label`. */
export function resolveUserRole(user: Pick<User, "role" | "role_label">): UserRole | string | null {
  return (
    normalizeUserRole(user.role) ??
    normalizeUserRole(user.role_label) ??
    user.role ??
    null
  );
}

function roleLabelIndicatesAdmin(roleLabel: string | undefined): boolean {
  const label = roleLabel?.trim().toLowerCase() ?? "";
  if (!label) {
    return false;
  }
  return label.includes("administrator") || label.includes("topadministrator");
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
      if (!parsed?.email) {
        continue;
      }
      const role = normalizeUserRole(parsed.role) ?? parsed.role;
      return {
        ...parsed,
        role,
        must_change_password: Boolean(parsed.must_change_password),
        password_policy_exempt: Boolean(parsed.password_policy_exempt),
      };
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
  const role = resolveUserRole(user);
  return (
    role === "agent" ||
    role === "admin" ||
    role === "top_admin" ||
    role === "supporter"
  );
}

export function isTopAdmin(user: User | null): boolean {
  return canManageNavVisibility(user);
}

export function isAdmin(user: User | null): boolean {
  if (!user) {
    return false;
  }
  const role = resolveUserRole(user);
  if (role === "admin" || role === "top_admin") {
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
  return user?.role === "end_user";
}

export function isStardeskReviewer(user: User | null): boolean {
  if (!user) {
    return false;
  }
  return resolveUserRole(user) === "stardesk_reviewer";
}

/** Staff or Stardesk Reviewer — agent shell and browse access. */
export function hasAgentShellAccess(user: User | null): boolean {
  return isStaff(user) || isStardeskReviewer(user);
}

/** Staff-only Forbedringer tab (reviewers create notes on pages). */
export function canViewImprovements(user: User | null): boolean {
  return isStaff(user);
}
