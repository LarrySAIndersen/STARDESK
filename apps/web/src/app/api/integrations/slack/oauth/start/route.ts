import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";
import { TOKEN_COOKIE } from "@/lib/auth";

function redirectWithError(request: Request, error: string) {
  const url = new URL("/integrations/slack", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return redirectWithError(request, "not_authenticated");
  }

  const upstream = await fetch(buildBackendUrl("/api/v1/integrations/slack/oauth/start"), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return redirectWithError(request, "oauth_start_failed");
  }

  const data = (await upstream.json()) as { authorize_url?: string };
  if (!data.authorize_url) {
    return redirectWithError(request, "missing_authorize_url");
  }
  return NextResponse.redirect(data.authorize_url);
}
