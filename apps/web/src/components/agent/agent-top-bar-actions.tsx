"use client";

import { AgentClock } from "@/components/agent/agent-clock";
import { ApiHealthIndicator } from "@/components/agent/api-health-indicator";
import { ImpersonateUserButton } from "@/components/agent/impersonate-user-button";
import { TopBarUserMenu } from "@/components/agent/top-bar-user-menu";
import { TeamChatTopBarButton } from "@/components/team-chat/team-chat-top-bar-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { resolveUserAvatar } from "@/lib/user-avatar";
import type { User } from "@/types/user";

export function AgentTopBarActions({
  user,
  showTeamChat = false,
  actions,
  variant = "default",
  className,
}: Readonly<{
  user?: User | null;
  showTeamChat?: boolean;
  actions?: React.ReactNode;
  variant?: "default" | "chrome";
  className?: string;
}>) {
  const resolvedUser = user ? (resolveUserAvatar(user) ?? user) : null;
  const chrome = variant === "chrome";

  return (
    <div
      className={cn(
        "flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3",
        chrome && "wire-topheader__actions",
        className,
      )}
    >
      {showTeamChat ? <TeamChatTopBarButton /> : null}
      {resolvedUser ? (
        <ImpersonateUserButton user={resolvedUser} variant={chrome ? "chrome" : "default"} />
      ) : null}
      <ApiHealthIndicator />
      <AgentClock variant={chrome ? "chrome" : "default"} />
      <ThemeToggle className={chrome ? "wire-topheader__theme" : undefined} />
      {actions}
      {resolvedUser ? (
        <TopBarUserMenu user={resolvedUser} variant={chrome ? "chrome" : "default"} />
      ) : null}
    </div>
  );
}
