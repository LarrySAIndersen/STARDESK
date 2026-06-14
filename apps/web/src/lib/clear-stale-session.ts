import "server-only";

import { cookies } from "next/headers";

import { TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";

/** Drop HttpOnly session cookies when JWT is present but `/me` rejects it. */
export async function clearStaleSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
  cookieStore.delete(USER_COOKIE);
}
