import type { PanelImperativeHandle } from "react-resizable-panels";

import { SHELL_NAV_COLLAPSED_WIDTH } from "@/lib/shell-layout";

const COLLAPSED_WIDTH_TOLERANCE_PX = 4;

function isNavPanelNarrow(panel: PanelImperativeHandle): boolean {
  return panel.getSize().inPixels <= SHELL_NAV_COLLAPSED_WIDTH + COLLAPSED_WIDTH_TOLERANCE_PX;
}

/** Keep resizable nav panel in sync with sidebar collapsed preference. */
export function syncShellNavPanel(
  panel: PanelImperativeHandle | null | undefined,
  collapsed: boolean,
  expandedWidthPx: number,
): void {
  if (!panel) return;

  if (collapsed) {
    panel.collapse();
    return;
  }

  if (panel.isCollapsed()) {
    panel.expand();
  }

  if (isNavPanelNarrow(panel)) {
    panel.resize(expandedWidthPx);
  }
}
