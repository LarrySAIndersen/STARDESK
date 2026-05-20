/** Format queue wait duration for Danish UI. */
export function formatWaitSeconds(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) {
    return "";
  }
  if (seconds < 60) {
    return `${seconds} sek.`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min.`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours} t. ${rem} min.` : `${hours} t.`;
}

export function formatEstimatedWaitMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) {
    return "ukendt";
  }
  return `ca. ${minutes} min.`;
}
