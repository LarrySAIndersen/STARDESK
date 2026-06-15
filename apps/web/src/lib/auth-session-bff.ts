import { NextResponse } from "next/server";

import { TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";
import { userForSessionCookie } from "@/lib/must-change-password";
import type { LoginResponse } from "@/types/user";

/** Shorter session — re-login required after idle window (no long-lived client tokens). */
export const SESSION_MAX_AGE = 60 * 60 * 2;

export function jsonWithSessionCookies(data: LoginResponse) {
  const sessionUser = userForSessionCookie(data.user);
  const response = NextResponse.json({ user: sessionUser });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(TOKEN_COOKIE, data.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  response.cookies.set(USER_COOKIE, JSON.stringify(sessionUser), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
