import type { UserRole } from "@/types/user";

export type ReviewNoteRoleColor = Readonly<{
  label: string;
  pinClassName: string;
  surfaceClassName: string;
}>;

const DEFAULT_ROLE_COLOR: ReviewNoteRoleColor = {
  label: "Agent",
  pinClassName:
    "border-star-blue/45 bg-star-blue-light text-star-navy hover:border-star-blue/60",
  surfaceClassName: "border-l-star-blue bg-star-blue-light/40",
};

export const REVIEW_NOTE_ROLE_COLORS: Record<UserRole, ReviewNoteRoleColor> = {
  top_admin: {
    label: "Topadministrator",
    pinClassName:
      "border-star-navy/55 bg-[color-mix(in_srgb,var(--star-navy)_12%,white)] text-star-navy hover:border-star-navy/70",
    surfaceClassName:
      "border-l-star-navy bg-[color-mix(in_srgb,var(--star-navy)_10%,white)]",
  },
  admin: {
    label: "Administrator",
    pinClassName: "border-star-navy/40 bg-star-blue-light text-star-navy hover:border-star-navy/55",
    surfaceClassName: "border-l-star-navy bg-star-blue-light/50",
  },
  supporter: {
    label: "Supporter",
    pinClassName:
      "border-[color-mix(in_srgb,var(--asset-cat-integration)_45%,transparent)] bg-[var(--asset-cat-integration-muted)] text-star-navy",
    surfaceClassName:
      "border-l-[var(--asset-cat-integration)] bg-[var(--asset-cat-integration-muted)]",
  },
  agent: DEFAULT_ROLE_COLOR,
  stardesk_reviewer: {
    label: "Stardesk Reviewer",
    pinClassName: "border-star-red/40 bg-star-red-light text-star-navy hover:border-star-red/55",
    surfaceClassName: "border-l-star-red bg-star-red-light/50",
  },
  end_user: {
    label: "Slutbruger",
    pinClassName:
      "border-[var(--gray-border)] bg-[var(--gray-light)] text-star-navy hover:border-star-navy/25",
    surfaceClassName: "border-l-[var(--gray-mid)] bg-[var(--gray-light)]",
  },
  kundeportal_2: {
    label: "Kundeportal #2",
    pinClassName:
      "border-[color-mix(in_srgb,var(--asset-cat-service)_40%,transparent)] bg-[color-mix(in_srgb,var(--asset-cat-service)_12%,white)] text-star-navy",
    surfaceClassName:
      "border-l-[var(--asset-cat-service)] bg-[color-mix(in_srgb,var(--asset-cat-service)_10%,white)]",
  },
};

export function reviewNoteRoleColor(role: string | null | undefined): ReviewNoteRoleColor {
  if (role && role in REVIEW_NOTE_ROLE_COLORS) {
    return REVIEW_NOTE_ROLE_COLORS[role as UserRole];
  }
  return DEFAULT_ROLE_COLOR;
}
