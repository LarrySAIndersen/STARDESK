"use client";

import { usePathname } from "next/navigation";

import { CaseAssistantChat } from "@/components/portal/case-assistant-chat";
import { shouldMountCaseAssistant } from "@/lib/case-assistant-visibility";
import type { User } from "@/types/user";

export function CaseAssistantHost({ user }: { user: User | null }) {
  const pathname = usePathname();

  if (!shouldMountCaseAssistant(user, pathname)) {
    return null;
  }

  return <CaseAssistantChat user={user} pathname={pathname} />;
}
