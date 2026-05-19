"use client";

import { TopBarUserMenu } from "@/components/agent/top-bar-user-menu";
import { resolveUserAvatar } from "@/lib/user-avatar";
import type { User } from "@/types/user";

export function SidebarUserFooter({ user }: { user: User }) {
  return (
    <footer className="wire-sidebar-footer border-t border-[var(--gray-border)] px-3.5 py-2.5">
      <TopBarUserMenu user={resolveUserAvatar(user) ?? user} />
    </footer>
  );
}
