import { buildBackendUrl } from "@/lib/api-backend";

export const runtime = "nodejs";

/** Public OpenAPI spec for Swagger UI (no auth). */
export async function GET() {
  const upstream = await fetch(buildBackendUrl("/openapi.json"), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ detail: "Kunne ikke hente OpenAPI-spec fra API-backend." }),
      {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const body = await upstream.text();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
