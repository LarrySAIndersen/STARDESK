/** Parse FastAPI error body from integration OAuth upstream calls. */
export async function readIntegrationOAuthUpstreamError(
  response: Response,
): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail.trim();
    }
  } catch {
    // ignore JSON parse errors
  }

  if (response.status === 401) {
    return "Du er ikke logget ind. Log ind og prøv igen.";
  }
  if (response.status === 403) {
    return "Kun administratorer kan forbinde Slack og Gmail.";
  }
  if (response.status === 503) {
    return (
      "Integrationen er ikke konfigureret på API-serveren (manglende OAuth-nøgler). " +
      "Kontakt STARdesk drift."
    );
  }
  return "oauth_start_failed";
}
