"use client";

import { getClientUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

export const PORTAL_LOGGED_IN_LABEL = "Logget ind som";

export function truncatePortalEmail(email: string, max = 28): string {
  if (email.length <= max) {
    return email;
  }
  return `${email.slice(0, max - 1)}…`;
}

export function portalUserLabel(user: Pick<User, "display_name" | "email">): string {
  const name = user.display_name?.trim();
  if (name) {
    return name;
  }
  const email = user.email?.trim();
  if (email) {
    return truncatePortalEmail(email);
  }
  return "Bruger";
}

export function portalUserInitials(user: Pick<User, "display_name" | "email">): string {
  const name = user.display_name?.trim();
  if (name) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  const email = user.email?.trim();
  if (email) {
    return email[0]?.toUpperCase() ?? "?";
  }
  return "?";
}

type PortalLoggedInAsProps = Readonly<{
  user?: User | null;
  /** White SiteHeader bar (Sager / Opret sag). */
  variant?: "header" | "topbar";
  industrialChrome?: boolean;
  /** When false, only label text (pair with UserAvatar in wire top bar). */
  showAvatar?: boolean;
  className?: string;
}>;

export function PortalLoggedInAs({
  user: userProp,
  variant = "header",
  industrialChrome = false,
  showAvatar = true,
  className,
}: PortalLoggedInAsProps) {
  const user = userProp ?? getClientUser();
  if (!user) {
    return null;
  }

  const label = portalUserLabel(user);
  const initials = portalUserInitials(user);

  const nameClass = industrialChrome
    ? "font-medium text-white"
    : "font-medium text-star-navy dark:text-foreground";
  const prefixClass = industrialChrome ? "text-[#94a3b8]" : "text-[#64748b] dark:text-muted-foreground";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        variant === "header" && "border-border max-w-[min(100%,14rem)] border-l pl-3 sm:max-w-xs",
        variant === "topbar" && "min-w-0",
        className,
      )}
      aria-label={`${PORTAL_LOGGED_IN_LABEL} ${label}`}
    >
      {showAvatar ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-star-blue font-semibold text-white",
            variant === "header" ? "size-8 text-xs" : "size-7 text-[10px]",
          )}
          aria-hidden
        >
          {initials}
        </span>
      ) : null}
      <p
        className={cn(
          "min-w-0 truncate leading-tight",
          variant === "header" ? "text-sm" : "text-[11px] sm:text-xs",
          variant === "topbar" && "hidden sm:block",
        )}
      >
        <span className={prefixClass}>{PORTAL_LOGGED_IN_LABEL} </span>
        <span className={nameClass}>{label}</span>
      </p>
    </div>
  );
}
