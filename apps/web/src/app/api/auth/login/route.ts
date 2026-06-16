import { NextResponse } from "next/server";

import {
  buildBackendUrl,
  getApiBackendBase,
  getApiBackendFallbackBase,
  shouldFallbackAuthUpstream,
} from "@/lib/api-backend";
import { jsonWithSessionCookies } from "@/lib/auth-session-bff";
import {
  backendUpstreamHeaders,
  isVercelDeploymentProtectionResponse,
  UPSTREAM_PROTECTION_BLOCKED_DETAIL,
} from "@/lib/vercel-protection-bypass";
import type { LoginResponse } from "@/types/user";

async function postLoginUpstream(
  apiBase: string,
  request: Request,
  body: unknown,
): Promise<Response> {
  return fetch(buildBackendUrl("/api/v1/auth/login", apiBase), {
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
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const primaryBase = getApiBackendBase();
  const fallbackBase = getApiBackendFallbackBase();
  let upstream: Response;

  try {
    upstream = await postLoginUpstream(primaryBase, request, body);
  } catch {
    return NextResponse.json(
      { detail: "Login mislykkedes — API er ikke tilgængelig" },
      { status: 503 },
    );
  }

  if (shouldFallbackAuthUpstream(upstream, primaryBase, fallbackBase)) {
    try {
      upstream = await postLoginUpstream(fallbackBase, request, body);
    } catch {
      return NextResponse.json(
        { detail: "Login mislykkedes — API er ikke tilgængelig" },
        { status: 503 },
      );
    }
  }

  if (!upstream.ok) {
    if (isVercelDeploymentProtectionResponse(upstream)) {
      return NextResponse.json({ detail: UPSTREAM_PROTECTION_BLOCKED_DETAIL }, { status: 503 });
    }
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

  let data: LoginResponse;
  try {
    data = (await upstream.json()) as LoginResponse;
  } catch {
    return NextResponse.json(
      { detail: "Login mislykkedes — ugyldigt svar fra API" },
      { status: 502 },
    );
  }

  if (!data.access_token) {
    return NextResponse.json(
      { detail: "Login mislykkedes — mangler adgangstoken" },
      { status: 502 },
    );
  }

  return jsonWithSessionCookies(data);
}
