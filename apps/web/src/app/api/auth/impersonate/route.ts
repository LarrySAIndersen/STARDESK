import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";
import { jsonWithSessionCookies } from "@/lib/auth-session-bff";
import { TOKEN_COOKIE } from "@/lib/auth";
import { backendUpstreamHeaders } from "@/lib/vercel-protection-bypass";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Ikke logget ind" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const upstream = await fetch(buildBackendUrl("/api/v1/auth/impersonate"), {
    method: "POST",
    headers: backendUpstreamHeaders({
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!upstream.ok) {
    let detail = "Kunne ikke impersonere bruger";
    try {
      const err = (await upstream.json()) as { detail?: string };
      if (typeof err.detail === "string") {
        detail = err.detail;
      }
    } catch {
      // ignore
    }
    if (upstream.status === 404) {
      detail =
        "Impersonering er ikke tilgængelig på den valgte API-backend. Kontakt administrator eller prøv igen efter staging-deploy.";
    }
    return NextResponse.json({ detail }, { status: upstream.status });
  }

  const data = await upstream.json();
  return jsonWithSessionCookies(data);
}
