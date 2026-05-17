import type { User } from "@/types/user";

export const TOKEN_COOKIE = "stardesk_token";
export const USER_COOKIE = "stardesk_user";

export function setSession(token: string, user: User) {
  const maxAge = 60 * 60 * 12;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  const secureFlag = secure ? "; Secure" : "";
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
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
  try {
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("="))) as User;
  } catch {
    return null;
  }
}

export function isStaff(user: User | null): boolean {
  return user?.role === "agent" || user?.role === "admin";
}

export function isSubmitter(user: User | null): boolean {
  return user?.role === "end_user";
}
