import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";
import { jsonWithSessionCookies } from "@/lib/auth-session-bff";
import { backendUpstreamHeaders } from "@/lib/vercel-protection-bypass";
import type { LoginResponse } from "@/types/user";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const upstream = await fetch(buildBackendUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: backendUpstreamHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Forwarded-For":
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        "",
    }),
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
  return jsonWithSessionCookies(data);
}
