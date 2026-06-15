import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { buildBackendUrl } from "@/lib/api-backend";
import { jsonWithSessionCookies } from "@/lib/auth-session-bff";
import { TOKEN_COOKIE } from "@/lib/auth";
import { backendUpstreamHeaders } from "@/lib/vercel-protection-bypass";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Ikke logget ind" }, { status: 401 });
  }

  const upstream = await fetch(buildBackendUrl("/api/v1/auth/stop-impersonate"), {
    method: "POST",
    headers: backendUpstreamHeaders({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    let detail = "Kunne ikke afslutte impersonering";
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

  const data = await upstream.json();
  return jsonWithSessionCookies(data);
}
