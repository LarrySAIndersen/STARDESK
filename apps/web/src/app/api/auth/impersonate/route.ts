import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  postAuthUpstreamWithStagingFallback,
  resolveAuthUpstreamErrorDetail,
} from "@/lib/auth-upstream-bff";
import { jsonWithSessionCookies } from "@/lib/auth-session-bff";
import { TOKEN_COOKIE } from "@/lib/auth";

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

  const { upstream, detail: overrideDetail } = await postAuthUpstreamWithStagingFallback({
    path: "/api/v1/auth/impersonate",
    token,
    body,
    request,
  });

  if (!upstream.ok) {
    const detail = await resolveAuthUpstreamErrorDetail(
      upstream,
      "Kunne ikke impersonere bruger",
      overrideDetail,
    );
    return NextResponse.json({ detail }, { status: upstream.status });
  }

  const data = await upstream.json();
  return jsonWithSessionCookies(data);
}
