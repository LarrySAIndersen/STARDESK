import "server-only";

import { apiGetServer } from "@/lib/api-server";
import { isTopAdmin } from "@/lib/auth";
import { isNavPathHidden } from "@/lib/agent-nav";
import type { User } from "@/types/user";

export async function fetchHiddenNavIds(): Promise<string[]> {
  try {
    const data = await apiGetServer<{ hidden_nav_ids: string[] }>(
      "/api/v1/platform/sidebar-nav-visibility",
    );
    return data.hidden_nav_ids ?? [];
  } catch {
    return [];
  }
}

export async function isStaffPathBlockedForUser(
  pathname: string,
  user: User | null,
): Promise<boolean> {
  if (!user) {
    return false;
  }
  const hidden = await fetchHiddenNavIds();
  return isNavPathHidden(pathname, hidden, isTopAdmin(user));
}
