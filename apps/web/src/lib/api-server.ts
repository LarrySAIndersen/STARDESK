import { cookies } from "next/headers";

import { buildBackendUrl } from "@/lib/api-backend";
import { ApiError } from "@/lib/api";
import { TOKEN_COOKIE } from "@/lib/auth";

async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type ApiGetServerOptions = {
  /** Seconds to cache read-only reference data (teams, categories). */
  revalidate?: number;
};

export async function apiGetServer<T>(
  path: string,
  options?: ApiGetServerOptions,
): Promise<T> {
  const revalidate = options?.revalidate;
  const response = await fetch(buildBackendUrl(path), {
    headers: await authHeaders(),
    ...(revalidate !== undefined
      ? { next: { revalidate } }
      : { cache: "no-store" as const }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API-fejl: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
