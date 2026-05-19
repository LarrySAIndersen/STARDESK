"use client";

import { AgentSidebarUser } from "@/components/agent/agent-sidebar-user";
import type { User } from "@/types/user";

export function SidebarUserFooter({ user }: { user: User }) {
  return (
    <footer className="wire-sidebar-user-footer">
      <AgentSidebarUser user={user} />
    </footer>
  );
}
