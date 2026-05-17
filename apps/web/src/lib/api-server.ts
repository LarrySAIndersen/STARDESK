import { cookies } from "next/headers";

import { ApiError } from "@/lib/api";
import { TOKEN_COOKIE } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function buildUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiGetServer<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API-fejl: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
