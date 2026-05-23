import { apiErrorMessage, parseApiErrorDetail } from "@/lib/api-errors";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function resolveClientUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return normalized;
  }
  if (normalized.startsWith("/api/v1/")) {
    return `/api/proxy/${normalized.slice("/api/".length)}`;
  }
  return normalized;
}

async function throwApiError(response: Response): Promise<never> {
  const detail = await parseApiErrorDetail(response);
  throw new ApiError(response.status, apiErrorMessage(detail));
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveClientUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiPostNoContent(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<void> {
  const response = await fetch(resolveClientUrl(path), {
    method: "POST",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    await throwApiError(response);
  }
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(resolveClientUrl(path), {
    method: "POST",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiPostForm<T>(
  path: string,
  formData: FormData,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(resolveClientUrl(path), {
    method: "POST",
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json() as Promise<T>;
}

export function attachmentDownloadUrl(ticketId: string, attachmentId: string): string {
  return `/api/proxy/v1/tickets/${ticketId}/attachments/${attachmentId}/download`;
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(resolveClientUrl(path), {
    method: "PUT",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(resolveClientUrl(path), {
    method: "PATCH",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json() as Promise<T>;
}

export async function apiDelete(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(resolveClientUrl(path), {
    method: "DELETE",
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    await throwApiError(response);
  }
}
