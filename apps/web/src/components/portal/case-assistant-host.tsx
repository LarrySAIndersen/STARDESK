"use client";

import { usePathname } from "next/navigation";

import { CaseAssistantChat } from "@/components/portal/case-assistant-chat";
import { isStaff } from "@/lib/auth";
import type { User } from "@/types/user";

function showCaseAssistantOnPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/portal" || pathname === "/tickets/new") {
    return true;
  }
  if (pathname.startsWith("/portal/") || pathname.startsWith("/portal-v2/")) {
    return true;
  }
  return false;
}

export function CaseAssistantHost({ user }: { user: User | null }) {
  const pathname = usePathname();

  if (!user || isStaff(user)) {
    return null;
  }

  if (!showCaseAssistantOnPath(pathname)) {
    return null;
  }

  return <CaseAssistantChat user={user} />;
}
