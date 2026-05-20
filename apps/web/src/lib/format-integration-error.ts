/** Map known integration API errors to clearer Danish copy. */
export function formatIntegrationError(message: string): string {
  if (message.includes("ikke knyttet til en organisation")) {
    return (
      "Din konto mangler organisationstilknytning. SF-administratorer bruger automatisk " +
      "SF Operations til Slack og Gmail — genindlæs siden og prøv igen."
    );
  }
  if (message.includes("Ingen aktiv organisation fundet")) {
    return "Der findes ingen aktiv organisation i systemet. Opret en organisation under Brugere før du forbinder integrationer.";
  }
  return message;
}
