"use client";

import { useId, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

import { cn } from "@/lib/utils";

const PANEL_IDS = ["panel-a", "panel-b"] as const;

type ResizableSplitProps = {
  children: [ReactNode, ReactNode];
  /** Persists panel sizes in localStorage when set */
  storageKey?: string;
  direction?: "horizontal" | "vertical";
  defaultSizes?: [number, number];
  minSizes?: [number, number];
  className?: string;
  panelClassName?: string;
};

export function ResizableSplit({
  children,
  storageKey,
  direction = "horizontal",
  defaultSizes = [20, 80],
  minSizes = [12, 40],
  className,
  panelClassName,
}: ResizableSplitProps) {
  const [first, second] = children;
  const generatedId = useId();
  const layoutId = storageKey ?? generatedId;

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: layoutId,
    panelIds: [...PANEL_IDS],
    ...(storageKey ? { storage: localStorage } : {}),
  });

  const initialLayout = defaultLayout ?? {
    [PANEL_IDS[0]]: defaultSizes[0],
    [PANEL_IDS[1]]: defaultSizes[1],
  };

  const resizeLabel =
    direction === "horizontal"
      ? "Træk for at ændre bredde"
      : "Træk for at ændre højde";

  return (
    <Group
      id={layoutId}
      orientation={direction}
      defaultLayout={initialLayout}
      onLayoutChanged={storageKey ? onLayoutChanged : undefined}
      className={cn("min-h-0 min-w-0", className)}
    >
      <Panel
        id={PANEL_IDS[0]}
        defaultSize={defaultSizes[0]}
        minSize={minSizes[0]}
        className={cn("min-h-0 min-w-0", panelClassName)}
      >
        {first}
      </Panel>
      <Separator
        className={cn(
          "group relative z-10 shrink-0 bg-border transition-colors",
          direction === "horizontal"
            ? "w-px hover:w-1 hover:bg-primary/40 data-[separator-active]:w-1 data-[separator-active]:bg-primary/50"
            : "h-px hover:h-1 hover:bg-primary/40 data-[separator-active]:h-1 data-[separator-active]:bg-primary/50",
        )}
        aria-label={resizeLabel}
      >
        <span
          className={cn(
            "bg-border group-hover:bg-primary/30 absolute rounded-full transition-colors",
            direction === "horizontal"
              ? "top-1/2 left-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2"
              : "top-1/2 left-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2",
          )}
          aria-hidden
        />
      </Separator>
      <Panel
        id={PANEL_IDS[1]}
        defaultSize={defaultSizes[1]}
        minSize={minSizes[1]}
        className={cn("min-h-0 min-w-0", panelClassName)}
      >
        {second}
      </Panel>
    </Group>
  );
}
