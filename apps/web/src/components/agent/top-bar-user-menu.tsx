"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { ProfileModal } from "@/components/agent/agent-sidebar-user";
import { UserAvatar } from "@/components/agent/user-avatar";
import { clearSession, writeUserCookie } from "@/lib/auth";
import { resolveUserAvatar, userProfileHref } from "@/lib/user-avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

function UserActionLinks({
  profileHref,
  onChangeAvatar,
  onLogout,
  className,
}: {
  profileHref: string;
  onChangeAvatar: () => void;
  onLogout: () => void;
  className?: string;
}) {
  return (
    <>
      <Link href={profileHref} className={cn("wire-topbar-user-action", className)}>
        Se mere
      </Link>
      <button
        type="button"
        className={cn("wire-topbar-user-action", className)}
        onClick={onChangeAvatar}
        aria-haspopup="dialog"
      >
        Skift billede
      </button>
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

export function TopBarUserMenu({ user: userFromServer }: { user: User }) {
  const router = useRouter();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
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

  const onUserChange = useCallback((next: User) => {
    writeUserCookie(next);
    setUser(next);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearSession();
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  const profileHref = userProfileHref(user);

  return (
    <>
      <div className="wire-topbar-user" aria-label="Brugerkonto">
        <div className="wire-topbar-user-identity">
          <UserAvatar user={user} size="md" />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-[11px] font-bold text-star-navy">{user.display_name}</p>
            <p className="truncate text-[10px] text-[var(--gray-mid)]">{user.role_label}</p>
          </div>
        </div>

        <nav
          className="wire-topbar-user-actions hidden lg:flex"
          aria-label="Brugerkonto"
        >
          <UserActionLinks
            profileHref={profileHref}
            onChangeAvatar={() => setAvatarOpen(true)}
            onLogout={() => void logout()}
          />
        </nav>

        <div className="relative lg:hidden" ref={menuRef}>
          <button
            type="button"
            className="wire-topbar-user-menu-trigger"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">Brugermenu</span>
            <ChevronDown
              className={cn("size-4 text-[var(--gray-mid)] transition-transform", menuOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {menuOpen ? (
            <div id={menuId} className="wire-topbar-user-dropdown" role="menu">
              <UserActionLinks
                profileHref={profileHref}
                onChangeAvatar={() => {
                  setMenuOpen(false);
                  setAvatarOpen(true);
                }}
                onLogout={() => void logout()}
                className="wire-topbar-user-dropdown-action"
              />
            </div>
          ) : null}
        </div>
      </div>

      {avatarOpen ? (
        <ProfileModal
          user={user}
          onClose={() => setAvatarOpen(false)}
          onUserChange={onUserChange}
        />
      ) : null}
    </>
  );
}
