import "server-only";

import { apiGetServer } from "@/lib/api-server";
import { firstAllowedStaffPath, isStaffPathBlocked } from "@/lib/agent-nav";
import { canManageNavVisibility } from "@/lib/top-admin";
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
  return isStaffPathBlocked(pathname, hidden, user);
}

export async function firstAllowedStaffPathForUser(
  user: User | null,
): Promise<string> {
  const hidden = await fetchHiddenNavIds();
  return firstAllowedStaffPath(hidden, canManageNavVisibility(user));
}
