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
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** @deprecated Use POST /api/auth/login — token is HttpOnly server-side. */
export function setSession(_token: string, user: User) {
  writeUserCookie(user);
}

/** Update `stardesk_user` after profile changes (avatar, etc.). */
export function writeUserCookie(user: User) {
  const maxAge = 60 * 60 * 12;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  const secureFlag = secure ? "; Secure" : "";
  document.cookie = `${USER_COOKIE}=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
}

export function clearSession() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${USER_COOKIE}=; path=/; max-age=0`;
}

export function getClientToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${TOKEN_COOKIE}=`));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match.split("=").slice(1).join("="));
}

export function getClientUser(): User | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${USER_COOKIE}=`));
  if (!match) {
    return null;
  }
  return parseUserFromCookie(match.split("=").slice(1).join("="));
}

export function isStaff(user: User | null): boolean {
  if (!user) {
    return false;
  }
  const role = resolveUserRole(user);
  return role === "agent" || role === "admin" || role === "top_admin";
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
