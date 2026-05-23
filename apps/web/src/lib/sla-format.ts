const CLOSED_STATUSES = new Set(["resolved", "closed", "cancelled"]);

export function formatSlaDuration(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}t`);
  }
  if (minutes > 0 || parts.length > 0) {
    parts.push(`${minutes}m`);
  }
  if (days === 0 && hours === 0) {
    parts.push(`${seconds}s`);
  }
  return parts.join(" ");
}

export function slaCountdownLabel(
  remainingSeconds: number | null | undefined,
  breached: boolean | undefined,
  status: string,
): string {
  if (CLOSED_STATUSES.has(status)) {
    return "SLA afsluttet";
  }
  if (remainingSeconds == null) {
    return "—";
  }
  if (breached || remainingSeconds < 0) {
    return "SLA overskredet";
  }
  return "SLA tid tilbage";
}

/**
 * Prefer `resolution_due_at` (ISO UTC from API) so the client clock stays aligned
 * with server SLA math. Fall back to `sla_remaining_seconds` only when due is missing.
 */
export function computeRemainingSeconds(
  resolutionDueAt: string | null | undefined,
  serverRemainingSeconds: number | null | undefined,
): number | null {
  if (resolutionDueAt) {
    return Math.floor((new Date(resolutionDueAt).getTime() - Date.now()) / 1000);
  }
  if (serverRemainingSeconds != null) {
    return serverRemainingSeconds;
  }
  return null;
}

export function formatSlaCountdownValue(remainingSeconds: number, breached: boolean): string {
  const duration = formatSlaDuration(remainingSeconds);
  if (breached || remainingSeconds < 0) {
    return `${duration} overskredet`;
  }
  return duration;
}
