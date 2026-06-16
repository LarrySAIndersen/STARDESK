import { cookies } from "next/headers";

import {
  buildBackendUrl,
  getApiBackendBase,
  getApiBackendFallbackBase,
  shouldFallbackServerUpstream,
} from "@/lib/api-backend";
import { ApiError } from "@/lib/api";
import { apiErrorMessage, parseApiErrorDetail } from "@/lib/api-errors";
import { TOKEN_COOKIE } from "@/lib/auth";
import { backendUpstreamHeaders } from "@/lib/vercel-protection-bypass";

/** Avoid infinite SSR Suspense when upstream is unreachable. */
const SERVER_FETCH_TIMEOUT_MS = 25_000;

async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...backendUpstreamHeaders(),
  };
}

type ApiGetServerOptions = {
  /** Seconds to cache read-only reference data (e.g. categories). Avoid for live counts. */
  revalidate?: number;
};

async function throwServerApiError(response: Response): Promise<never> {
  const detail = await parseApiErrorDetail(response);
  throw new ApiError(response.status, apiErrorMessage(detail));
}

export async function apiGetServer<T>(
  path: string,
  options?: ApiGetServerOptions,
): Promise<T> {
  const revalidate = options?.revalidate;
  const primaryBase = getApiBackendBase();
  const fallbackBase = getApiBackendFallbackBase();
  const headers = await authHeaders();
  const fetchInit = {
    headers,
    signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    ...(revalidate !== undefined
      ? { next: { revalidate } }
      : { cache: "no-store" as const }),
  };

  let response = await fetch(buildBackendUrl(path, primaryBase), fetchInit);

  if (shouldFallbackServerUpstream(response, primaryBase, fallbackBase)) {
    response = await fetch(buildBackendUrl(path, fallbackBase), fetchInit);
  }

  if (!response.ok) {
    await throwServerApiError(response);
  }
  return response.json() as Promise<T>;
}
