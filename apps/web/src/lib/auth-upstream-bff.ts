import {
  buildBackendUrl,
  getApiBackendFallbackBase,
  getStagingApiBackendBase,
  getStagingCapableAuthBackendBase,
  IMPERSONATION_SESSION_MISMATCH_DETAIL,
  shouldFallbackAuthUpstream,
  shouldRetryAuthOnStagingForMissingRoute,
} from "@/lib/api-backend";
import { backendUpstreamHeaders } from "@/lib/vercel-protection-bypass";

type AuthUpstreamInit = {
  path: string;
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  request?: Request;
};

async function fetchAuthUpstream(
  apiBase: string,
  init: AuthUpstreamInit,
): Promise<Response> {
  const headers = backendUpstreamHeaders({
    Accept: "application/json",
    ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(init.request
      ? {
          "X-Forwarded-For":
            init.request.headers.get("x-forwarded-for") ??
            init.request.headers.get("x-real-ip") ??
            "",
        }
      : {}),
  });

  return fetch(buildBackendUrl(init.path, apiBase), {
    method: init.method ?? "POST",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
}

async function readUpstreamDetail(upstream: Response, fallback: string): Promise<string> {
  try {
    const err = (await upstream.json()) as { detail?: string };
    if (typeof err.detail === "string") {
      return err.detail;
    }
  } catch {
    // ignore
  }
  return fallback;
}

/** Auth BFF upstream with staging fallback for routes missing on production (impersonate). */
export async function postAuthUpstreamWithStagingFallback(
  init: AuthUpstreamInit,
): Promise<{ upstream: Response; detail?: string }> {
  const primaryBase = getStagingCapableAuthBackendBase();
  const stagingBase = getStagingApiBackendBase();
  const fallbackBase = getApiBackendFallbackBase();

  let upstream: Response;
  try {
    upstream = await fetchAuthUpstream(primaryBase, init);
  } catch {
    return { upstream: new Response(null, { status: 503 }) };
  }

  if (shouldFallbackAuthUpstream(upstream, primaryBase, fallbackBase)) {
    try {
      upstream = await fetchAuthUpstream(fallbackBase, init);
    } catch {
      return { upstream: new Response(null, { status: 503 }) };
    }
  }

  if (shouldRetryAuthOnStagingForMissingRoute(upstream, primaryBase, stagingBase)) {
    try {
      const stagingUpstream = await fetchAuthUpstream(stagingBase!, init);
      if (stagingUpstream.ok) {
        return { upstream: stagingUpstream };
      }
      if (stagingUpstream.status === 401 || stagingUpstream.status === 403) {
        return {
          upstream: stagingUpstream,
          detail: IMPERSONATION_SESSION_MISMATCH_DETAIL,
        };
      }
      upstream = stagingUpstream;
    } catch {
      // keep original 404 from production
    }
  }

  if (!upstream.ok && upstream.status === 404) {
    const detail = await readUpstreamDetail(
      upstream,
      "Impersonering er ikke tilgængelig på den valgte API-backend. Kontakt administrator eller prøv igen efter staging-deploy.",
    );
    return { upstream, detail };
  }

  return { upstream };
}

export async function resolveAuthUpstreamErrorDetail(
  upstream: Response,
  fallback: string,
  overrideDetail?: string,
): Promise<string> {
  if (overrideDetail) {
    return overrideDetail;
  }
  return readUpstreamDetail(upstream, fallback);
}
