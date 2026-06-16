import { NextResponse } from "next/server";

import {
  buildBackendUrl,
  getApiBackendBase,
  getApiBackendFallbackBase,
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
  let upstream = await postLoginUpstream(primaryBase, request, body);

  if (
    !upstream.ok &&
    isVercelDeploymentProtectionResponse(upstream)
  ) {
    const fallbackBase = getApiBackendFallbackBase();
    if (fallbackBase !== primaryBase) {
      upstream = await postLoginUpstream(fallbackBase, request, body);
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

  const data = (await upstream.json()) as LoginResponse;
  return jsonWithSessionCookies(data);
}
