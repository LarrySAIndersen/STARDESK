import type { AgentNavItem } from "@/lib/agent-nav";

export const NAV_LAYOUT_STORAGE_KEY = "stardesk-nav-layout";
export const NAV_LAYOUT_VERSION = 1;

export type NavSectionId =
  | "main"
  | "graenseflade"
  | "administration"
  | "slutbrugere"
  | "integration";

export type NavSectionDef = {
  id: NavSectionId;
  label: string | null;
};

export const NAV_SECTIONS: NavSectionDef[] = [
  { id: "main", label: null },
  { id: "graenseflade", label: "Grænseflade" },
  { id: "administration", label: "Administration" },
  { id: "slutbrugere", label: "Slutbrugere" },
  { id: "integration", label: "Integration" },
];

export type NavLayoutEntry = {
  id: string;
  sectionId: NavSectionId;
};

export type NavLayout = {
  version: typeof NAV_LAYOUT_VERSION;
  entries: NavLayoutEntry[];
};

const SECTION_LABEL_TO_ID: Record<string, NavSectionId> = {
  Administration: "administration",
  Slutbrugere: "slutbrugere",
  Integration: "integration",
  Grænseflade: "graenseflade",
};

export function defaultSectionForItem(item: AgentNavItem): NavSectionId {
  if (!item.section) {
    return "main";
  }
  return SECTION_LABEL_TO_ID[item.section] ?? "main";
}

export function buildDefaultNavLayout(
  items: AgentNavItem[],
  options: { includeClassicUi: boolean },
): NavLayout {
  const entries: NavLayoutEntry[] = items.map((item) => ({
    id: item.id,
    sectionId: defaultSectionForItem(item),
  }));

  if (options.includeClassicUi) {
    const serviceDeskIndex = entries.findIndex((entry) => entry.id === "service-desk");
    const insertAt = serviceDeskIndex >= 0 ? serviceDeskIndex + 1 : entries.length;
    entries.splice(insertAt, 0, {
      id: "classic-ui",
      sectionId: "graenseflade",
    });
  }

  return { version: NAV_LAYOUT_VERSION, entries };
}

const VALID_SECTION_IDS = new Set<NavSectionId>(NAV_SECTIONS.map((section) => section.id));

function isValidNavLayoutEntry(
  entry: unknown,
  availableIds: Set<string>,
): entry is NavLayoutEntry {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const candidate = entry as NavLayoutEntry;
  return (
    typeof candidate.id === "string" &&
    availableIds.has(candidate.id) &&
    typeof candidate.sectionId === "string" &&
    VALID_SECTION_IDS.has(candidate.sectionId)
  );
}

export function sanitizeNavLayout(
  saved: NavLayout | null,
  defaultLayout: NavLayout,
  availableIds: Set<string>,
): NavLayout {
  if (!saved || saved.version !== NAV_LAYOUT_VERSION || !Array.isArray(saved.entries)) {
    return defaultLayout;
  }

  const entries = saved.entries.filter((entry) => isValidNavLayoutEntry(entry, availableIds));
  const uniqueEntries: NavLayoutEntry[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    uniqueEntries.push(entry);
  }

  if (uniqueEntries.length === 0) {
    return defaultLayout;
  }

  for (const entry of defaultLayout.entries) {
    if (seen.has(entry.id)) {
      continue;
    }
    uniqueEntries.push(entry);
  }

  return { version: NAV_LAYOUT_VERSION, entries: uniqueEntries };
}

export function mergeNavLayout(
  saved: NavLayout | null,
  defaultLayout: NavLayout,
  availableIds: Set<string>,
): NavLayout {
  if (!saved || saved.version !== NAV_LAYOUT_VERSION) {
    return defaultLayout;
  }

  return sanitizeNavLayout(saved, defaultLayout, availableIds);
}

export function groupLayoutBySection(
  layout: NavLayout,
  availableIds: Set<string>,
): { sectionId: NavSectionId; entries: NavLayoutEntry[] }[] {
  const sectionMap = new Map<NavSectionId, NavLayoutEntry[]>(
    NAV_SECTIONS.map((section) => [section.id, []]),
  );

  for (const entry of layout.entries) {
    if (!availableIds.has(entry.id)) {
      continue;
    }
    const bucket = sectionMap.get(entry.sectionId) ?? [];
    bucket.push(entry);
    sectionMap.set(entry.sectionId, bucket);
  }

  return NAV_SECTIONS.map((section) => ({
    sectionId: section.id,
    entries: sectionMap.get(section.id) ?? [],
  })).filter((section) => section.entries.length > 0);
}

export function moveNavEntry(
  layout: NavLayout,
  draggedId: string,
  targetSectionId: NavSectionId,
  beforeId?: string | null,
): NavLayout {
  const entries = layout.entries.filter((entry) => entry.id !== draggedId);
  const dragged = layout.entries.find((entry) => entry.id === draggedId);
  if (!dragged) {
    return layout;
  }

  const nextEntry: NavLayoutEntry = { id: draggedId, sectionId: targetSectionId };
  if (beforeId) {
    const index = entries.findIndex((entry) => entry.id === beforeId);
    if (index >= 0) {
      entries.splice(index, 0, nextEntry);
      return { version: NAV_LAYOUT_VERSION, entries };
    }
  }

  let insertIndex = entries.length;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.sectionId === targetSectionId) {
      insertIndex = index + 1;
      break;
    }
  }
  entries.splice(insertIndex, 0, nextEntry);
  return { version: NAV_LAYOUT_VERSION, entries };
}

export function readNavLayoutFromStorage(): NavLayout | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(NAV_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as NavLayout;
    if (parsed?.version !== NAV_LAYOUT_VERSION || !Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeNavLayoutToStorage(layout: NavLayout): void {
  try {
    localStorage.setItem(NAV_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

export const NAV_DRAG_MIME = "application/x-stardesk-nav-item";
