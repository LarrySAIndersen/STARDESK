/** Map known integration API errors to clearer Danish copy. */
export function formatIntegrationError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Der opstod en ukendt fejl med integrationen.";
  }

  if (trimmed.includes("ikke knyttet til en organisation")) {
    return (
      "Din konto mangler organisationstilknytning. SF-administratorer bruger automatisk " +
      "SF Operations til Slack og Gmail — genindlæs siden og prøv igen."
    );
  }
  if (trimmed.includes("Ingen aktiv organisation fundet")) {
    return "Der findes ingen aktiv organisation i systemet. Opret en organisation under Brugere før du forbinder integrationer.";
  }
  if (
    trimmed.includes("OAuth mangler konfiguration") ||
    trimmed.includes("manglende OAuth-nøgler") ||
    trimmed.includes("ikke konfigureret på API-serveren")
  ) {
    return (
      "Slack/Gmail er ikke sat op på produktions-API'en endnu. " +
      "Drift skal tilføje SLACK_CLIENT_ID, SLACK_REDIRECT_URI, GOOGLE_CLIENT_ID og GMAIL_REDIRECT_URI " +
      "i Vercel (api-projektet) og redeploye."
    );
  }
  if (trimmed === "oauth_start_failed") {
    return "Kunne ikke starte OAuth. Tjek at du er logget ind som administrator, og prøv igen.";
  }
  if (trimmed.includes("not_authenticated") || trimmed.includes("ikke logget ind")) {
    return "Du er ikke logget ind. Log ind og prøv igen.";
  }
  if (trimmed.includes("Kun administratorer")) {
    return trimmed;
  }
  return trimmed;
}
