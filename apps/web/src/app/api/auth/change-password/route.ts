import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";
import { TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";
import { userForSessionCookie } from "@/lib/must-change-password";
import type { LoginResponse, User } from "@/types/user";

const SESSION_MAX_AGE = 60 * 60 * 2;

type ChangePasswordBody = {
  email?: string;
  current_password?: string;
  new_password?: string;
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const upstream = await fetch(buildBackendUrl("/api/v1/auth/change-password"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!upstream.ok) {
    let detail = "Kunne ikke ændre adgangskode";
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

  const response = new NextResponse(null, { status: 204 });
  const secure = process.env.NODE_ENV === "production";
  const payload = body as ChangePasswordBody;
  const email = payload.email?.trim().toLowerCase();
  const newPassword = payload.new_password;

  if (email && newPassword) {
    const loginResponse = await fetch(buildBackendUrl("/api/v1/auth/login"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: newPassword }),
      cache: "no-store",
    });
    if (loginResponse.ok) {
      const data = (await loginResponse.json()) as LoginResponse;
      response.cookies.set(TOKEN_COOKIE, data.access_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
      response.cookies.set(USER_COOKIE, JSON.stringify(userForSessionCookie(data.user)), {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
      return response;
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (token) {
    const meResponse = await fetch(buildBackendUrl("/api/v1/auth/me"), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (meResponse.ok) {
      const user = (await meResponse.json()) as User;
      response.cookies.set(USER_COOKIE, JSON.stringify(userForSessionCookie(user)), {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
    }
  }
  return response;
}
