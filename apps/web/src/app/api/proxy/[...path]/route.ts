import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildBackendUrl,
  getApiBackendBase,
  isProtectedStagingApiHost,
  STAGING_JWT_MISMATCH_DETAIL,
} from "@/lib/api-backend";
import { TOKEN_COOKIE } from "@/lib/auth";
import { vercelProtectionBypassHeaders } from "@/lib/vercel-protection-bypass";

async function proxyRequest(request: Request, pathSegments: string[]) {
  const path = `/api/${pathSegments.join("/")}`;
  const incoming = new URL(request.url);
  const target = new URL(buildBackendUrl(path));
  target.search = incoming.search;

  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Accept", request.headers.get("accept") ?? "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  for (const [key, value] of Object.entries(vercelProtectionBypassHeaders())) {
    headers.set(key, value);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "API er midlertidigt utilgængelig. Prøv igen om et øjeblik." },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) {
    responseHeaders.set("Content-Type", upstreamType);
  }
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) {
    responseHeaders.set("Content-Disposition", disposition);
  }
  const location = upstream.headers.get("location");
  if (location) {
    responseHeaders.set("Location", location);
  }

  const apiBase = getApiBackendBase();
  if (
    token &&
    upstream.status === 401 &&
    isProtectedStagingApiHost(apiBase) &&
    (upstreamType?.includes("application/json") ?? true)
  ) {
    return NextResponse.json({ detail: STAGING_JWT_MISMATCH_DETAIL }, { status: 401 });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
