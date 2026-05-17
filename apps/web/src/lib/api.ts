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

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | { title?: string } };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (body.detail && typeof body.detail === "object" && body.detail.title) {
      return body.detail.title;
    }
  } catch {
    // ignore
  }
  return `API-fejl: ${response.status}`;
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
    throw new ApiError(response.status, await parseError(response));
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
    throw new ApiError(response.status, await parseError(response));
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
    throw new ApiError(response.status, await parseError(response));
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
    throw new ApiError(response.status, await parseError(response));
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
    throw new ApiError(response.status, await parseError(response));
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
    throw new ApiError(response.status, await parseError(response));
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
    throw new ApiError(response.status, await parseError(response));
  }
}
