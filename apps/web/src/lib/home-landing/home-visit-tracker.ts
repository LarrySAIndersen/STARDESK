/**
 * Tracks how many times the user opened home today (client-only).
 */
const STORAGE_PREFIX = "stardesk:home-visits:";

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function recordHomeVisit(userId: string): number {
  if (typeof window === "undefined") {
    return 1;
  }
  const key = `${STORAGE_PREFIX}${userId}:${todayKey()}`;
  try {
    const current = Number.parseInt(localStorage.getItem(key) ?? "0", 10);
    const next = Number.isFinite(current) ? current + 1 : 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function readHomeVisitCount(userId: string): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const key = `${STORAGE_PREFIX}${userId}:${todayKey()}`;
  try {
    const current = Number.parseInt(localStorage.getItem(key) ?? "0", 10);
    return Number.isFinite(current) ? current : 0;
  } catch {
    return 0;
  }
}
