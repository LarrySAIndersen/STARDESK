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

  if (!user) {
    return null;
  }

  // If user is staff, show on all pages. If not staff, only show on allowed paths.
  if (!isStaff(user) && !showCaseAssistantOnPath(pathname)) {
    return null;
  }

  return <CaseAssistantChat user={user} />;
}
