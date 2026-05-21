import { isStaff } from "@/lib/auth";
import type { User } from "@/types/user";

/** UI flow preference: modern STARdesk wireframe vs classic (TOPdesk-style) modules. */
export const UI_MODE_COOKIE = "stardesk_ui_mode";

export type UiMode = "modern" | "classic";

export function parseUiMode(raw: string | undefined | null): UiMode {
  return raw === "classic" ? "classic" : "modern";
}

export function classicHomePath(): string {
  return "/classic";
}

export function modernHomePath(): string {
  return "/";
}

export type UiModeLock = UiMode | null | undefined;

/** DB `users.ui_mode` overrides cookie when set. */
export function resolveEffectiveUiMode(
  uiModeLock: UiModeLock,
  cookieValue: string | undefined | null,
): UiMode {
  if (uiModeLock === "classic" || uiModeLock === "modern") {
    return uiModeLock;
  }
  return parseUiMode(cookieValue);
}

export function isClassicOnlyUser(uiModeLock: UiModeLock): boolean {
  return uiModeLock === "classic";
}

export function isModernOnlyUser(uiModeLock: UiModeLock): boolean {
  return uiModeLock === "modern";
}

/** Staff routes outside classic shell — redirect classic-only users away. */
/** Where staff should land after login or when visiting `/`. */
export function staffLandingPath(
  user: User | null,
  cookieUiMode?: string | null,
): string {
  if (!isStaff(user)) {
    return modernHomePath();
  }
  if (resolveEffectiveUiMode(user?.ui_mode, cookieUiMode) === "classic") {
    return classicHomePath();
  }
  return modernHomePath();
}

export function isModernStaffPath(pathname: string): boolean {
  if (pathname.startsWith("/classic")) return false;
  if (pathname.startsWith("/portal")) return false;
  if (pathname === "/" || pathname.startsWith("/login")) return false;
  if (
    pathname === "/skift-adgangskode" ||
    pathname.startsWith("/skift-adgangskode/")
  ) {
    return false;
  }
  return true;
}
