import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  postAuthUpstreamWithStagingFallback,
  resolveAuthUpstreamErrorDetail,
} from "@/lib/auth-upstream-bff";
import { jsonWithSessionCookies } from "@/lib/auth-session-bff";
import { TOKEN_COOKIE } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Ikke logget ind" }, { status: 401 });
  }

  const { upstream, detail: overrideDetail } = await postAuthUpstreamWithStagingFallback({
    path: "/api/v1/auth/stop-impersonate",
    token,
  });

  if (!upstream.ok) {
    const detail = await resolveAuthUpstreamErrorDetail(
      upstream,
      "Kunne ikke afslutte impersonering",
      overrideDetail,
    );
    return NextResponse.json({ detail }, { status: upstream.status });
  }

  const data = await upstream.json();
  return jsonWithSessionCookies(data);
}
