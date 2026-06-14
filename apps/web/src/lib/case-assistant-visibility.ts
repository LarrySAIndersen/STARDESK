import { hasAgentShellAccess } from "@/lib/auth";
import type { User } from "@/types/user";

export function showCaseAssistantOnPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/portal" || pathname === "/tickets/new") {
    return true;
  }
  if (pathname.startsWith("/portal/") || pathname.startsWith("/portal-v2/")) {
    return true;
  }
  return false;
}

export function shouldMountCaseAssistant(user: User | null, pathname: string): boolean {
  if (!user) {
    return false;
  }

  const agentShellAccess = hasAgentShellAccess(user);

  // End-user home uses the inline STARbot card; agent-shell users need the floating host.
  if (pathname === "/" && !agentShellAccess) {
    return false;
  }

  return agentShellAccess || showCaseAssistantOnPath(pathname);
}
