import type { PanelImperativeHandle } from "react-resizable-panels";

/** Pixel sizes for Aktiver resizable columns (react-resizable-panels numeric = px). */
export const ASSETS_AUDIT = {
  default: 260,
  min: 220,
  max: 420,
  /** Below this width the column is unusable — show expand control. */
  narrow: 260,
} as const;

export const ASSETS_TREE = {
  default: 280,
  min: 240,
  max: 520,
  narrow: 260,
} as const;

export function syncAssetPanelIfNarrow(
  panel: PanelImperativeHandle | null | undefined,
  defaultWidthPx: number,
  narrowThresholdPx: number,
): void {
  if (!panel) return;
  if (panel.getSize().inPixels < narrowThresholdPx) {
    panel.resize(defaultWidthPx);
  }
}
