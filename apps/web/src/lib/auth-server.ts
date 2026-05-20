import "server-only";

import { cookies } from "next/headers";

import { apiGetServer } from "@/lib/api-server";
import { TOKEN_COOKIE, normalizeUserRole } from "@/lib/auth";
import type { User } from "@/types/user";

/** Server session user — authoritative source is JWT + API `/me` only. */
export async function getServerUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const me = await apiGetServer<User>("/api/v1/auth/me");
    const role = normalizeUserRole(me.role) ?? me.role;
    return { ...me, role };
  } catch {
    return null;
  }
}
