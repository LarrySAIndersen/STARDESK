"use client";

import { useId, type ReactNode } from "react";

import { useIsLgUp } from "@/hooks/use-media-query";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

import { getPanelLayoutStorage } from "@/lib/panel-layout-storage";
import { cn } from "@/lib/utils";

const PANEL_IDS = ["panel-a", "panel-b"] as const;

type ResizableSplitProps = Readonly<{
  children: [ReactNode, ReactNode];
  /** Persists panel sizes in localStorage when set */
  storageKey?: string;
  direction?: "horizontal" | "vertical";
  defaultSizes?: [number, number];
  minSizes?: [number, number];
  className?: string;
  panelClassName?: string;
  /** Below lg, render panels stacked without resize handles. */
  stackBelowLg?: boolean;
}>;

export function ResizableSplit({
  children,
  storageKey,
  direction = "horizontal",
  defaultSizes = [20, 80],
  minSizes = [12, 40],
  className,
  panelClassName,
  stackBelowLg = false,
}: ResizableSplitProps) {
  const [first, second] = children;
  const isLgUp = useIsLgUp();
  const generatedId = useId();
  const layoutId = storageKey ?? generatedId;

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: layoutId,
    panelIds: [...PANEL_IDS],
    storage: getPanelLayoutStorage(),
  });

  const initialLayout = defaultLayout ?? {
    [PANEL_IDS[0]]: defaultSizes[0],
    [PANEL_IDS[1]]: defaultSizes[1],
  };

  const resizeLabel =
    direction === "horizontal"
      ? "Træk for at ændre bredde"
      : "Træk for at ændre højde";

  if (stackBelowLg && !isLgUp) {
    return (
      <div className={cn("flex min-h-0 min-w-0 flex-col gap-4", className)}>
        <div className={cn("min-h-0 min-w-0", panelClassName)}>{first}</div>
        <div className={cn("min-h-0 min-w-0", panelClassName)}>{second}</div>
      </div>
    );
  }

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
