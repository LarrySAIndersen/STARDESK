import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";

function redirectWithError(request: Request, error: string) {
  const nextUrl = new URL("/integrations/gmail", request.url);
  nextUrl.searchParams.set("error", error);
  return NextResponse.redirect(nextUrl);
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const target = new URL(buildBackendUrl("/api/v1/integrations/gmail/oauth/callback"));
  target.search = incoming.search;

  const upstream = await fetch(target, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!upstream.ok) {
    try {
      const data = (await upstream.json()) as { detail?: string };
      return redirectWithError(request, data.detail ?? "oauth_callback_failed");
    } catch {
      return redirectWithError(request, "oauth_callback_failed");
    }
  }

  const nextUrl = new URL("/integrations/gmail", request.url);
  nextUrl.searchParams.set("connected", "1");
  return NextResponse.redirect(nextUrl);
}
