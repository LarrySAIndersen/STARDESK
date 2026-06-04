"use client";

import { useCallback, useLayoutEffect, type RefObject } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import { syncAssetPanelIfNarrow } from "@/lib/assets-layout";

type AssetPanelSyncTarget = Readonly<{
  ref: RefObject<PanelImperativeHandle | null>;
  enabled: boolean;
  defaultWidthPx: number;
  narrowThresholdPx: number;
}>;

export function useSyncAssetPanels(targets: AssetPanelSyncTarget[]): void {
  const run = useCallback(() => {
    for (const target of targets) {
      if (!target.enabled) continue;
      syncAssetPanelIfNarrow(
        target.ref.current,
        target.defaultWidthPx,
        target.narrowThresholdPx,
      );
    }
  }, [targets]);

  useLayoutEffect(() => {
    run();
    const frame = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(frame);
  }, [run]);
}

export function useAssetPanelNarrow(
  inPixels: number | null,
  narrowThresholdPx: number,
): boolean {
  if (inPixels === null) return true;
  return inPixels < narrowThresholdPx;
}
