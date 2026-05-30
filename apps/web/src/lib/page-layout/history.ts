import type { PageLayoutPageConfig } from "@/lib/page-layout/types";

export const MAX_LAYOUT_UNDO_DEPTH = 50;

export function clonePageLayout(config: PageLayoutPageConfig): PageLayoutPageConfig {
  return JSON.parse(JSON.stringify(config)) as PageLayoutPageConfig;
}

export function pushUndoSnapshot(
  stack: PageLayoutPageConfig[],
  snapshot: PageLayoutPageConfig,
): PageLayoutPageConfig[] {
  const next = [...stack, clonePageLayout(snapshot)];
  if (next.length > MAX_LAYOUT_UNDO_DEPTH) {
    return next.slice(next.length - MAX_LAYOUT_UNDO_DEPTH);
  }
  return next;
}
