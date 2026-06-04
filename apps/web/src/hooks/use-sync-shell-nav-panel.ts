"use client";

import { useCallback, useLayoutEffect, type RefObject } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import { syncShellNavPanel } from "@/lib/sync-shell-nav-panel";

/** Sync nav panel width with sidebar collapsed state; retries expand on next frame. */
export function useSyncShellNavPanel(
  navPanelRef: RefObject<PanelImperativeHandle | null>,
  collapsed: boolean,
  expandedWidthPx: number,
  enabled: boolean,
): void {
  useLayoutEffect(() => {
    if (!enabled) return;

    const run = () => {
      syncShellNavPanel(navPanelRef.current, collapsed, expandedWidthPx);
    };

    run();

    if (collapsed) return;

    const frame = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(frame);
  }, [collapsed, enabled, expandedWidthPx, navPanelRef]);
}

/** Toggle sidebar and immediately sync the resizable nav panel (panel ref may lag one frame). */
export function useShellNavToggle(
  navPanelRef: RefObject<PanelImperativeHandle | null>,
  collapsed: boolean,
  onToggle: () => void,
  expandedWidthPx: number,
): () => void {
  return useCallback(() => {
    const nextCollapsed = !collapsed;
    onToggle();
    requestAnimationFrame(() => {
      syncShellNavPanel(navPanelRef.current, nextCollapsed, expandedWidthPx);
      requestAnimationFrame(() => {
        syncShellNavPanel(navPanelRef.current, nextCollapsed, expandedWidthPx);
      });
    });
  }, [collapsed, expandedWidthPx, navPanelRef, onToggle]);
}
