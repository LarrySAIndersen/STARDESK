"use client";

import { CaseAssistantHost } from "@/components/portal/case-assistant-host";
import { getClientUser } from "@/lib/auth";
import type { User } from "@/types/user";

export function CaseAssistantShellClient({ user }: { user: User | null }) {
  const clientUser = getClientUser() ?? user;
  return <CaseAssistantHost user={clientUser} />;
}
