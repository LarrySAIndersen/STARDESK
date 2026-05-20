import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";
import { TOKEN_COOKIE } from "@/lib/auth";
import { readIntegrationOAuthUpstreamError } from "@/lib/integration-oauth-errors";

export type IntegrationOAuthId = "slack" | "gmail";

function settingsPath(integration: IntegrationOAuthId): `/integrations/${IntegrationOAuthId}` {
  return `/integrations/${integration}`;
}

function redirectToSettings(
  request: Request,
  integration: IntegrationOAuthId,
  params: Record<string, string>,
): NextResponse {
  const url = new URL(settingsPath(integration), request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/** BFF: start Slack/Gmail OAuth (requires session cookie). */
export async function proxyIntegrationOAuthStart(
  request: Request,
  integration: IntegrationOAuthId,
): Promise<NextResponse> {
  const onError = (error: string) => redirectToSettings(request, integration, { error });

  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return onError("Du er ikke logget ind. Log ind og prøv igen.");
  }

  const upstream = await fetch(
    buildBackendUrl(`/api/v1/integrations/${integration}/oauth/start`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  if (!upstream.ok) {
    const detail = await readIntegrationOAuthUpstreamError(upstream);
    return onError(detail);
  }

  const data = (await upstream.json()) as { authorize_url?: string };
  if (!data.authorize_url) {
    return onError("API returnerede ikke en OAuth-URL.");
  }
  return NextResponse.redirect(data.authorize_url);
}

/** BFF: OAuth callback proxy → integration settings with ?connected=1 or ?error=… */
export async function proxyIntegrationOAuthCallback(
  request: Request,
  integration: IntegrationOAuthId,
): Promise<NextResponse> {
  const onError = (error: string) => redirectToSettings(request, integration, { error });

  const incoming = new URL(request.url);
  const target = new URL(
    buildBackendUrl(`/api/v1/integrations/${integration}/oauth/callback`),
  );
  target.search = incoming.search;

  const upstream = await fetch(target, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!upstream.ok) {
    const detail = await readIntegrationOAuthUpstreamError(upstream);
    return onError(detail);
  }

  return redirectToSettings(request, integration, { connected: "1" });
}
