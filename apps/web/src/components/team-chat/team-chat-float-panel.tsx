"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const POS_STORAGE_KEY = "stardesk_team_chat_panel_pos";
const SIZE_STORAGE_KEY = "stardesk_team_chat_panel_size";
const DEFAULT_SIZE = { width: 720, height: 480 };
const MIN_SIZE = { width: 360, height: 280 };
const MARGIN = 12;

const DRAG_BLOCK_SELECTOR =
  "button, a, input, textarea, select, option, label, [role='button'], [contenteditable='true'], .team-chat-messages, .team-chat-channel-scroll, .team-chat-composer, .team-chat-float-resize-edge";

type Point = Readonly<{ x: number; y: number }>;
type Size = Readonly<{ width: number; height: number }>;
type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_EDGES: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function parseStoredPoint(raw: string | null): Point | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // ignore
  }
  return null;
}

function parseStoredSize(raw: string | null): Size | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { width?: number; height?: number };
    if (typeof parsed.width === "number" && typeof parsed.height === "number") {
      return { width: parsed.width, height: parsed.height };
    }
  } catch {
    // ignore
  }
  return null;
}

function clampSize(width: number, height: number): Size {
  const maxW = window.innerWidth - MARGIN * 2;
  const maxH = window.innerHeight - MARGIN * 2;
  return {
    width: Math.min(Math.max(MIN_SIZE.width, width), maxW),
    height: Math.min(Math.max(MIN_SIZE.height, height), maxH),
  };
}

function clampPosition(x: number, y: number, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(MARGIN, x), window.innerWidth - width - MARGIN),
    y: Math.min(Math.max(MARGIN, y), window.innerHeight - height - MARGIN),
  };
}

function defaultPosition(width: number, height: number): Point {
  return clampPosition(window.innerWidth - width - MARGIN, 72, width, height);
}

function isDragBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true;
  }
  return target.closest(DRAG_BLOCK_SELECTOR) !== null;
}

function applyResize(
  edge: ResizeEdge,
  dx: number,
  dy: number,
  startW: number,
  startH: number,
  originX: number,
  originY: number,
): { size: Size; pos: Point } {
  let width = startW;
  let height = startH;
  let x = originX;
  let y = originY;

  if (edge.includes("e")) {
    width = startW + dx;
  }
  if (edge.includes("w")) {
    width = startW - dx;
    x = originX + dx;
  }
  if (edge.includes("s")) {
    height = startH + dy;
  }
  if (edge.includes("n")) {
    height = startH - dy;
    y = originY + dy;
  }

  const size = clampSize(width, height);
  if (edge.includes("w")) {
    x = originX + (startW - size.width);
  }
  if (edge.includes("n")) {
    y = originY + (startH - size.height);
  }

  const pos = clampPosition(x, y, size.width, size.height);
  return { size, pos };
}

type TeamChatFloatPanelProps = Readonly<{
  open: boolean;
  children: ReactNode;
}>;

/** Floating STARchat panel — drag anywhere; resize on all edges and corners. */
export function TeamChatFloatPanel({ open, children }: TeamChatFloatPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const [pos, setPos] = useState<Point | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeStateRef = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    const storedPos = parseStoredPoint(localStorage.getItem(POS_STORAGE_KEY));
    const storedSize = parseStoredSize(localStorage.getItem(SIZE_STORAGE_KEY));
    if (storedSize) {
      setSize(clampSize(storedSize.width, storedSize.height));
    }
    if (storedPos) {
      setPos(storedPos);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
    } catch {
      // ignore
    }
  }, [hydrated, size]);

  useEffect(() => {
    if (!hydrated || !pos) return;
    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // ignore
    }
  }, [hydrated, pos]);

  const resolvedPos = pos ?? defaultPosition(size.width, size.height);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      dragStateRef.current = {
        startX: clientX,
        startY: clientY,
        originX: resolvedPos.x,
        originY: resolvedPos.y,
      };

      const onMove = (ev: PointerEvent) => {
        const drag = dragStateRef.current;
        if (!drag) return;
        const next = clampPosition(
          drag.originX + (ev.clientX - drag.startX),
          drag.originY + (ev.clientY - drag.startY),
          size.width,
          size.height,
        );
        setPos(next);
      };

      const onUp = () => {
        dragStateRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [resolvedPos.x, resolvedPos.y, size.width, size.height],
  );

  const onPanelPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0 || isDragBlockedTarget(event.target)) {
        return;
      }
      event.preventDefault();
      startDrag(event.clientX, event.clientY);
    },
    [startDrag],
  );

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent, edge: ResizeEdge) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      resizeStateRef.current = {
        edge,
        startX: event.clientX,
        startY: event.clientY,
        startW: size.width,
        startH: size.height,
        originX: resolvedPos.x,
        originY: resolvedPos.y,
      };

      const onMove = (ev: PointerEvent) => {
        const resize = resizeStateRef.current;
        if (!resize) return;
        const dx = ev.clientX - resize.startX;
        const dy = ev.clientY - resize.startY;
        const next = applyResize(
          resize.edge,
          dx,
          dy,
          resize.startW,
          resize.startH,
          resize.originX,
          resize.originY,
        );
        setSize(next.size);
        setPos(next.pos);
      };

      const onUp = () => {
        resizeStateRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [resolvedPos.x, resolvedPos.y, size.width, size.height],
  );

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={cn("team-chat-float-panel", open && "team-chat-float-panel--open")}
      style={{
        left: resolvedPos.x,
        top: resolvedPos.y,
        width: size.width,
        height: size.height,
      }}
      role="dialog"
      aria-label="STARchat"
    >
      <div className="team-chat-float-panel__inner" onPointerDown={onPanelPointerDown}>
        {children}
      </div>
      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge}
          className={cn("team-chat-float-resize-edge", `team-chat-float-resize-edge--${edge}`)}
          aria-hidden
          onPointerDown={(event) => onResizePointerDown(event, edge)}
        />
      ))}
    </div>
  );
}
