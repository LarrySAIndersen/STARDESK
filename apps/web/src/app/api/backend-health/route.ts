import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";

/** Proxies Vercel API `/health` for client-side API status checks (no JWT required). */
export async function GET() {
  try {
    const response = await fetch(buildBackendUrl("/health"), {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: "error", detail: `Backend HTTP ${response.status}` },
        { status: 503 },
      );
    }

    const body = (await response.json()) as { status?: string };
    if (body.status !== "ok") {
      return NextResponse.json(
        { status: "degraded", detail: "Backend rapporterer ikke ok." },
        { status: 503 },
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Kunne ikke kontakte backend.";
    return NextResponse.json({ status: "error", detail }, { status: 503 });
  }
}
