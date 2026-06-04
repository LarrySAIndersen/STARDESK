import { cookies } from "next/headers";

import { buildBackendUrl } from "@/lib/api-backend";
import { ApiError } from "@/lib/api";
import { apiErrorMessage, parseApiErrorDetail } from "@/lib/api-errors";
import { TOKEN_COOKIE } from "@/lib/auth";
import { vercelProtectionBypassHeaders } from "@/lib/vercel-protection-bypass";

/** Avoid infinite SSR Suspense when upstream is unreachable. */
const SERVER_FETCH_TIMEOUT_MS = 25_000;

async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...vercelProtectionBypassHeaders(),
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
  const response = await fetch(buildBackendUrl(path), {
    headers: await authHeaders(),
    signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    ...(revalidate !== undefined
      ? { next: { revalidate } }
      : { cache: "no-store" as const }),
  });
  if (!response.ok) {
    await throwServerApiError(response);
  }
  return response.json() as Promise<T>;
}
