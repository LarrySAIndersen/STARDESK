import "server-only";

import { cookies } from "next/headers";

import { apiGetServer } from "@/lib/api-server";
import {
  isAdmin,
  parseUserFromCookie,
  TOKEN_COOKIE,
  USER_COOKIE,
  normalizeUserRole,
} from "@/lib/auth";
import type { User } from "@/types/user";

/** Server session user — prefers JWT `/me` over cookie when logged in. */
export async function getServerUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const cookieUser = parseUserFromCookie(cookieStore.get(USER_COOKIE)?.value);
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return cookieUser;
  }
  try {
    const me = await apiGetServer<User>("/api/v1/auth/me");
    const role = normalizeUserRole(me.role) ?? me.role;
    const fromApi: User = { ...me, role };

    // Same session: prefer cookie when JWT `/me` is stale but login cookie has admin rights.
    if (
      cookieUser?.email === fromApi.email &&
      isAdmin(cookieUser) &&
      !isAdmin(fromApi)
    ) {
      return {
        ...fromApi,
        role: normalizeUserRole(cookieUser.role) ?? cookieUser.role,
        role_label: cookieUser.role_label || fromApi.role_label,
      };
    }

    return fromApi;
  } catch {
    return cookieUser;
  }
}
