/** FastAPI detail token when JWT user must change password before mutations (not a credential). */
export const MUST_CHANGE_PASSWORD_DETAIL = "must_change_password"; // NOSONAR typescript:S2068

/** Shown only on login redirect and the required change-password page — not in generic API errors. */
export const MUST_CHANGE_PASSWORD_MESSAGE =
  "Du skal skifte adgangskode før du kan fortsætte.";

export const CHANGE_PASSWORD_PATH = "/skift-adgangskode";

/** Neutral copy for 403 must_change_password in modals and toasts — never the first-login message. */
export const MUTATION_FORBIDDEN_MESSAGE = "Du har ikke adgang til denne handling.";

export function isMustChangePasswordError(
  status: number,
  detail: string | undefined,
): boolean {
  return status === 403 && detail === MUST_CHANGE_PASSWORD_DETAIL;
}

function detailFromJsonBody(body: { detail?: string | { title?: string } }): string | null {
  if (typeof body.detail === "string") {
    return body.detail;
  }
  if (body.detail && typeof body.detail === "object" && body.detail.title) {
    return body.detail.title;
  }
  return null;
}

export async function parseApiErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  let text = "";
  try {
    text = await response.text();
  } catch {
    return `API-fejl: ${response.status}`;
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const body = JSON.parse(trimmed) as { detail?: string | { title?: string } };
      const detail = detailFromJsonBody(body);
      if (detail) {
        return detail;
      }
    } catch {
      // fall through
    }
  } else if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(trimmed) as { detail?: string | { title?: string } };
      const detail = detailFromJsonBody(body);
      if (detail) {
        return detail;
      }
    } catch {
      // fall through
    }
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("<!doctype html") &&
    (lower.includes("authentication required") || lower.includes("vercel authentication"))
  ) {
    return "Deployment-beskyttelse blokerede API-kaldet. Genindlæs siden eller kontakt administrator.";
  }

  if (trimmed === "Authentication required") {
    return "HTTP Basic Auth kræves for dette miljø.";
  }

  if (trimmed.length > 0 && trimmed.length <= 300 && !trimmed.includes("<")) {
    return trimmed;
  }

  return `API-fejl: ${response.status}`;
}

export function apiErrorMessage(detail: string): string {
  if (detail === MUST_CHANGE_PASSWORD_DETAIL) {
    return MUTATION_FORBIDDEN_MESSAGE;
  }
  return detail;
}
