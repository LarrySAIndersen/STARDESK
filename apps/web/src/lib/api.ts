import { apiErrorMessage, parseApiErrorDetail } from "@/lib/api-errors";
import type { ReviewNote } from "@/types/review-note";

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
  if (response.status === 401) {
    const message =
      detail.startsWith("API-fejl:") || detail.includes("Deployment-beskyttelse")
        ? "Din session er udløbet. Log ind igen."
        : apiErrorMessage(detail);
    throw new ApiError(401, message);
  }
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

export function reviewNoteScreenshotUrl(noteId: string): string {
  return `/api/proxy/v1/review-notes/${noteId}/screenshot`;
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

export async function apiPutNoContent(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(resolveClientUrl(path), {
    method: "PUT",
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

function isReviewNoteDeleteFallbackError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

/** Try staging POST /delete, then PATCH soft-delete, then hard DELETE. */
export async function deleteReviewNote(noteId: string): Promise<ReviewNote | null> {
  try {
    await apiPostNoContent(`/api/v1/review-notes/${noteId}/delete`, {});
    return null;
  } catch (error) {
    if (!isReviewNoteDeleteFallbackError(error)) {
      throw error;
    }
  }

  try {
    return await apiPatch<ReviewNote>(`/api/v1/review-notes/${noteId}`, {
      status: "deleted",
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }

  await apiDelete(`/api/v1/review-notes/${noteId}`);
  return null;
}
