import type { Team } from "@/types/team";

/** Exact team names classified as internal (SF ecosystem). Extend as needed. */
export const INTERNAL_TEAM_NAMES = new Set([
  "SF",
  "Sirius",
  "North Star",
  "Virksomhed",
  "BI",
  "Jobflow",
  // Legacy names (pre-rename migrations)
  "SF A North Star Series",
  "Es Trifft",
]);

/** Preferred sort order within the internal section (unknown names sort after). */
const INTERNAL_DISPLAY_ORDER = [
  "SF",
  "SF Service Desk",
  "SF Operations",
  "SF Infrastruktur",
  "SF AI Operations",
  "Virksomhed",
  "North Star",
  "Jobflow",
  "Sirius",
  "BI",
];

function internalSortIndex(name: string): number {
  const index = INTERNAL_DISPLAY_ORDER.indexOf(name);
  return index === -1 ? INTERNAL_DISPLAY_ORDER.length + 1 : index;
}

export function isInternalTeam(name: string): boolean {
  if (INTERNAL_TEAM_NAMES.has(name)) {
    return true;
  }
  if (name === "SF" || name.startsWith("SF ")) {
    return true;
  }
  return false;
}

export function sortTeamsForDisplay(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    const aInternal = isInternalTeam(a.name);
    const bInternal = isInternalTeam(b.name);
    if (aInternal !== bInternal) {
      return aInternal ? -1 : 1;
    }
    if (aInternal) {
      const orderDiff = internalSortIndex(a.name) - internalSortIndex(b.name);
      if (orderDiff !== 0) {
        return orderDiff;
      }
    }
    if (a.name === "SF") {
      return -1;
    }
    if (b.name === "SF") {
      return 1;
    }
    return a.name.localeCompare(b.name, "da");
  });
}

export function partitionTeamsByCategory(teams: Team[]): {
  internal: Team[];
  external: Team[];
} {
  const sorted = sortTeamsForDisplay(teams);
  const internal: Team[] = [];
  const external: Team[] = [];
  for (const team of sorted) {
    if (isInternalTeam(team.name)) {
      internal.push(team);
    } else {
      external.push(team);
    }
  }
  return { internal, external };
}
