import type { PanelImperativeHandle } from "react-resizable-panels";

import { SHELL_NAV_COLLAPSED_WIDTH } from "@/lib/shell-layout";

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

  const { inPixels } = panel.getSize();
  if (inPixels <= SHELL_NAV_COLLAPSED_WIDTH + 4) {
    panel.resize(expandedWidthPx);
  }
}
