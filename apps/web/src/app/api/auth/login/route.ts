import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";
import { TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";
import type { LoginResponse } from "@/types/user";

const SESSION_MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const upstream = await fetch(buildBackendUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!upstream.ok) {
    let detail = "Forkert e-mail eller adgangskode";
    try {
      const err = (await upstream.json()) as { detail?: string };
      if (typeof err.detail === "string") {
        detail = err.detail;
      }
    } catch {
      // ignore
    }
    return NextResponse.json({ detail }, { status: upstream.status });
  }

  const data = (await upstream.json()) as LoginResponse;
  const response = NextResponse.json({ user: data.user });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(TOKEN_COOKIE, data.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  response.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(data.user)), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
