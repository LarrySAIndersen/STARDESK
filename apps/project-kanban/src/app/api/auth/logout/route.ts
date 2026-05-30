import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(secure), maxAge: 0 });
  return response;
}
