import { NextResponse } from "next/server";

import { buildBackendUrl, getApiBackendBase } from "@/lib/api-backend";
import {
  backendUpstreamHeaders,
  isVercelDeploymentProtectionResponse,
  UPSTREAM_PROTECTION_BLOCKED_DETAIL,
} from "@/lib/vercel-protection-bypass";

/** Proxies Vercel API `/health` for client-side API status checks (no JWT required). */
export async function GET() {
  const upstreamBase = getApiBackendBase();
  try {
    const response = await fetch(buildBackendUrl("/health"), {
      headers: backendUpstreamHeaders({ Accept: "application/json" }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!response.ok) {
      if (isVercelDeploymentProtectionResponse(response)) {
        return NextResponse.json(
          {
            status: "error",
            detail: UPSTREAM_PROTECTION_BLOCKED_DETAIL,
            upstream: upstreamBase,
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { status: "error", detail: `Backend HTTP ${response.status}`, upstream: upstreamBase },
        { status: 503 },
      );
    }

    const body = (await response.json()) as {
      status?: string;
      deployment?: string;
      stardesk_env?: string;
    };
    if (body.status !== "ok") {
      return NextResponse.json(
        { status: "degraded", detail: "Backend rapporterer ikke ok.", upstream: upstreamBase },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      upstream: upstreamBase,
      backend_deployment: body.deployment ?? null,
      stardesk_env: body.stardesk_env ?? null,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Kunne ikke kontakte backend.";
    return NextResponse.json({ status: "error", detail, upstream: upstreamBase }, { status: 503 });
  }
}
