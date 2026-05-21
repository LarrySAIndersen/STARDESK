export type ClassicRecentCard = {
  id: string;
  href: string;
  ticketNumber: string;
  title: string;
  /** Second line, e.g. reporter or assignee with org */
  subtitle: string;
  viewedAt: number;
};

const STORAGE_PREFIX = "stardesk-classic-recent-cards";
const MAX_RECENT = 40;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function loadRecentCards(userId: string): ClassicRecentCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const data = JSON.parse(raw) as ClassicRecentCard[];
    if (!Array.isArray(data)) return [];
    return data.filter(
      (c) =>
        typeof c.id === "string" &&
        typeof c.href === "string" &&
        typeof c.ticketNumber === "string" &&
        typeof c.title === "string",
    );
  } catch {
    return [];
  }
}

export function recordRecentCard(
  userId: string,
  card: Omit<ClassicRecentCard, "viewedAt">,
): ClassicRecentCard[] {
  if (typeof window === "undefined") return [];
  const entry: ClassicRecentCard = { ...card, viewedAt: Date.now() };
  const prev = loadRecentCards(userId).filter((c) => c.id !== card.id);
  const next = [entry, ...prev].slice(0, MAX_RECENT);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}
