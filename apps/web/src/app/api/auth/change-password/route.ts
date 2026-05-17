import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const upstream = await fetch(buildBackendUrl("/api/v1/auth/change-password"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!upstream.ok) {
    let detail = "Kunne ikke ændre adgangskode";
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

  return new NextResponse(null, { status: 204 });
}
