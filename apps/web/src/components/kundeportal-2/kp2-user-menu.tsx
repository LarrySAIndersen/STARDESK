"use client";

import { ChevronDown, Globe, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { clearSession } from "@/lib/auth";
import type { User as AppUser } from "@/types/user";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Kp2UserMenu({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function logout() {
    await clearSession();
    router.push("/login/helpdesk");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="kp2-user-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="kp2-user-avatar">{initials(user.display_name ?? user.email)}</span>
        <ChevronDown className="size-4 opacity-70" aria-hidden />
      </button>
      {open ? (
        <div className="kp2-user-menu" role="menu">
          <p className="kp2-user-menu-name">{user.display_name ?? user.email}</p>
          <Link href="/profile" className="kp2-user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <User className="size-4" aria-hidden />
            Tilret profil
          </Link>
          <button type="button" className="kp2-user-menu-item w-full" role="menuitem">
            <Globe className="size-4" aria-hidden />
            Sprogindstilling
          </button>
          <button type="button" className="kp2-user-menu-item w-full" role="menuitem" onClick={logout}>
            <LogOut className="size-4" aria-hidden />
            Log af
          </button>
        </div>
      ) : null}
    </div>
  );
}
