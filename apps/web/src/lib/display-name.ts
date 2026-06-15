/** First token of display name for compact UI (e.g. seddel forside). */
export function firstName(displayName: string | null | undefined): string {
  const trimmed = displayName?.trim() ?? "";
  if (!trimmed) return "Ukendt";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
