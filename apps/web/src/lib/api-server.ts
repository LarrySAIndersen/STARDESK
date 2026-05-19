import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { buildBackendUrl } from "@/lib/api-backend";
import { ApiError } from "@/lib/api";
import {
  apiErrorMessage,
  CHANGE_PASSWORD_PATH,
  isMustChangePasswordError,
  parseApiErrorDetail,
} from "@/lib/api-errors";
import { parseUserFromCookie, TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";

async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type ApiGetServerOptions = {
  /** Seconds to cache read-only reference data (e.g. categories). Avoid for live counts. */
  revalidate?: number;
};

async function throwServerApiError(response: Response): Promise<never> {
  const detail = await parseApiErrorDetail(response);
  const cookieStore = await cookies();
  const sessionUser = parseUserFromCookie(cookieStore.get(USER_COOKIE)?.value);
  if (
    isMustChangePasswordError(response.status, detail) &&
    sessionUser?.must_change_password
  ) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  throw new ApiError(response.status, apiErrorMessage(detail));
}

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
    await throwServerApiError(response);
  }
  return response.json() as Promise<T>;
}
