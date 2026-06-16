"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { UserAvatar } from "@/components/agent/user-avatar";
import { PortalLoggedInAs } from "@/components/portal/portal-logged-in-as";
import { clearSession } from "@/lib/auth";
import { confirmSfChatLogout } from "@/lib/sf-chat-logout";
import { resolveUserAvatar, userProfileHref } from "@/lib/user-avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

function UserActionLinks({
  profileHref,
  onLogout,
  className,
}: {
  profileHref: string;
  onLogout: () => void;
  className?: string;
}) {
  return (
    <>
      <Link href="/min-side" className={cn("wire-topbar-user-action", className)}>
        Min side
      </Link>
      <Link href="/indstillinger" className={cn("wire-topbar-user-action", className)}>
        Personlige indstillinger
      </Link>
      <Link href={profileHref} className={cn("wire-topbar-user-action", className)}>
        Se mere
      </Link>
      <button
        type="button"
        className={cn("wire-topbar-user-action", className)}
        onClick={onLogout}
      >
        Log ud
      </button>
    </>
  );
}

export function TopBarUserMenu({
  user: userFromServer,
  variant = "default",
}: Readonly<{
  user: User;
  variant?: "default" | "chrome";
}>) {
  const router = useRouter();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(() => resolveUserAvatar(userFromServer) ?? userFromServer);

  useEffect(() => {
    setUser(resolveUserAvatar(userFromServer) ?? userFromServer);
  }, [userFromServer]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  async function logout() {
    const ok = await confirmSfChatLogout();
    if (!ok) return;
    await fetch("/api/auth/logout", { method: "POST" });
    clearSession();
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  const profileHref = userProfileHref(user);
  const chrome = variant === "chrome";

  return (
    <div
      className={cn("wire-topbar-user", chrome && "wire-topbar-user--chrome")}
      aria-label="Brugerkonto"
    >
      <div className="wire-topbar-user-identity">
        <UserAvatar user={user} size="md" />
        <PortalLoggedInAs
          user={user}
          variant="topbar"
          showAvatar={false}
          industrialChrome={chrome}
        />
      </div>

      <nav
        className={cn(
          "wire-topbar-user-actions hidden lg:flex",
          chrome && "wire-topbar-user-actions--chrome",
        )}
        aria-label="Brugerkonto"
      >
        <UserActionLinks
          profileHref={profileHref}
          onLogout={() => fireAndForget(logout())}
          className={chrome ? "wire-topbar-user-action--chrome" : undefined}
        />
      </nav>

      <div className="relative lg:hidden" ref={menuRef}>
        <button
          type="button"
          className={cn(
            "wire-topbar-user-menu-trigger",
            chrome && "wire-topbar-user-menu-trigger--chrome",
          )}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">Brugermenu</span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              chrome ? "text-white/85" : "text-[var(--gray-mid)]",
              menuOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {menuOpen ? (
          <div id={menuId} className="wire-topbar-user-dropdown" role="menu">
            <UserActionLinks
              profileHref={profileHref}
              onLogout={() => {
                setMenuOpen(false);
                fireAndForget(logout());
              }}
              className="wire-topbar-user-dropdown-action"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
