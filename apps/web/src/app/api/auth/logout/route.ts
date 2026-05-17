import { NextResponse } from "next/server";

import { TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(USER_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
