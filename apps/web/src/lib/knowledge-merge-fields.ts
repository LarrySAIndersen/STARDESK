/** Merge-field tokens linking tickets and knowledge articles (bidirectional). */

export type MergeFieldKind = "sag" | "kb";

export type ParsedMergeField = {
  kind: MergeFieldKind;
  ref: string;
  raw: string;
  index: number;
};

const MERGE_FIELD_PATTERN = /\{\{(sag|kb):([^}]+)\}\}/g;

export function parseMergeFields(text: string): ParsedMergeField[] {
  const fields: ParsedMergeField[] = [];
  for (const match of text.matchAll(MERGE_FIELD_PATTERN)) {
    const kind = match[1] as MergeFieldKind;
    const ref = match[2]?.trim() ?? "";
    if (!ref) continue;
    fields.push({
      kind,
      ref,
      raw: match[0],
      index: match.index ?? 0,
    });
  }
  return fields;
}

export function buildMergeField(kind: MergeFieldKind, ref: string): string {
  return `{{${kind}:${ref.trim()}}}`;
}

/** Staff route for a ticket number (prototype resolves by number in UI mock). */
export function ticketHrefForNumber(ticketNumber: string, ticketId?: string): string {
  if (ticketId) return `/tickets/${ticketId}`;
  return `/tickets?search=${encodeURIComponent(ticketNumber)}`;
}

/** Staff route for a knowledge article KB number or UUID. */
export function knowledgeHrefForRef(ref: string, articleId?: string): string {
  if (articleId) return `/knowledge/${articleId}`;
  return `/knowledge?search=${encodeURIComponent(ref)}`;
}

export const MERGE_FIELD_HELP_DA =
  "Brug {{sag:INC-2026-00087}} eller {{kb:KB-2024-00001}} i vidensartikel — flet vises som klikbare links på sagen og tilbage på artiklen.";
