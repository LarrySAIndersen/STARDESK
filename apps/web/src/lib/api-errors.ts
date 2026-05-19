/** FastAPI detail when JWT user must change password before mutations. */
export const MUST_CHANGE_PASSWORD_DETAIL = "must_change_password";

/** Shown only on login redirect and the required change-password page — not in generic API errors. */
export const MUST_CHANGE_PASSWORD_MESSAGE =
  "Du skal skifte adgangskode før du kan fortsætte.";

export const CHANGE_PASSWORD_PATH = "/skift-adgangskode?required=1";

/** Neutral copy for 403 must_change_password in modals and toasts — never the first-login message. */
export const MUTATION_FORBIDDEN_MESSAGE = "Du har ikke adgang til denne handling.";

export function isMustChangePasswordError(
  status: number,
  detail: string | undefined,
): boolean {
  return status === 403 && detail === MUST_CHANGE_PASSWORD_DETAIL;
}

export async function parseApiErrorDetail(response: Response): Promise<string> {
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

export function apiErrorMessage(detail: string): string {
  if (detail === MUST_CHANGE_PASSWORD_DETAIL) {
    return MUTATION_FORBIDDEN_MESSAGE;
  }
  return detail;
}
