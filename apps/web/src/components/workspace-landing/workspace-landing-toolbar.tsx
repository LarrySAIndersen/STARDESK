"use client";

import Link from "next/link";
import { LayoutGrid, Plus, RotateCcw, Settings2, UserCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  definitionForKind,
  widgetsForSpace,
} from "@/lib/workspace-landing/catalog";
import type { WorkspaceSpace, WorkspaceWidgetInstance } from "@/lib/workspace-landing/types";
import { cn } from "@/lib/utils";

const SPACE_TABS: { id: WorkspaceSpace; label: string; hint: string }[] = [
  {
    id: "personal",
    label: "Eget space",
    hint: "Dit personlige overblik — dashboard, noter og sager.",
  },
  {
    id: "team",
    label: "Team space",
    hint: "Fælles team-overblik — chat, KPI'er og kø.",
  },
];

type WorkspaceLandingToolbarProps = Readonly<{
  space: WorkspaceSpace;
  onSpaceChange: (space: WorkspaceSpace) => void;
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
  widgets: WorkspaceWidgetInstance[];
  onAddWidget: (kind: WorkspaceWidgetInstance["kind"]) => void;
  onResetLayout: () => void;
  userDisplayName?: string;
}>;

export function WorkspaceLandingToolbar({
  space,
  onSpaceChange,
  editMode,
  onEditModeChange,
  widgets,
  onAddWidget,
  onResetLayout,
  userDisplayName,
}: WorkspaceLandingToolbarProps) {
  const [addKind, setAddKind] = useState<string>("");
  const activeSpace = SPACE_TABS.find((tab) => tab.id === space) ?? SPACE_TABS[0];

  const availableToAdd = useMemo(() => {
    const activeKinds = new Set(widgets.filter((w) => !w.hidden).map((w) => w.kind));
    return widgetsForSpace(space).filter((def) => !activeKinds.has(def.kind));
  }, [space, widgets]);

  return (
    <header className="workspace-landing-toolbar border-b border-[var(--gray-border)] bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
            Arbejdsrum
          </p>
          <div
            className="mb-2 flex flex-wrap gap-1 rounded-lg border border-[var(--gray-border)] bg-white p-1"
            role="tablist"
            aria-label="Arbejdsrum"
          >
            {SPACE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={space === tab.id}
                onClick={() => onSpaceChange(tab.id)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
                  space === tab.id
                    ? "bg-star-navy text-white shadow-sm"
                    : "text-star-navy hover:bg-secondary",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm">{activeSpace.hint}</p>
          {space === "personal" && userDisplayName ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Hej {userDisplayName} — dashboard og Min side er samlet her.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {space === "personal" ? (
            <>
              <Link
                href="/profile"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <UserCircle className="size-3.5" aria-hidden />
                Profil
              </Link>
              <Link href="/tickets/new" className={cn(buttonVariants({ size: "sm" }))}>
                Opret sag
              </Link>
            </>
          ) : (
            <Link href="/chat" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Åbn teamchat
            </Link>
          )}

          <div className="flex items-center gap-1">
            <Select
              value={addKind}
              onValueChange={(value) => setAddKind(value ?? "")}
              disabled={availableToAdd.length === 0}
            >
              <SelectTrigger className="h-8 w-[11rem] text-xs" aria-label="Vælg widget">
                <SelectValue placeholder="Vælg widget" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((def) => (
                  <SelectItem key={def.kind} value={def.kind}>
                    {def.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!addKind || availableToAdd.length === 0}
              onClick={() => {
                if (!addKind) return;
                onAddWidget(addKind as WorkspaceWidgetInstance["kind"]);
                setAddKind("");
              }}
            >
              <Plus className="size-3.5" aria-hidden />
              Tilføj
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            variant={editMode ? "default" : "outline"}
            onClick={() => onEditModeChange(!editMode)}
            aria-pressed={editMode}
          >
            <Settings2 className="size-3.5" aria-hidden />
            {editMode ? "Færdig" : "Tilpas"}
          </Button>

          {editMode ? (
            <Button type="button" size="sm" variant="ghost" onClick={onResetLayout}>
              <RotateCcw className="size-3.5" aria-hidden />
              Nulstil
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function WorkspaceWidgetShell({
  instance,
  editMode,
  onMove,
  onToggleSpan,
  onHide,
  children,
}: Readonly<{
  instance: WorkspaceWidgetInstance;
  editMode: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggleSpan: () => void;
  onHide: () => void;
  children: React.ReactNode;
}>) {
  const definition = definitionForKind(instance.kind);

  return (
    <section
      className={cn(
        "workspace-widget",
        instance.span === "half" && "workspace-widget--half",
        editMode && "workspace-widget--editing",
      )}
      style={{ order: instance.order }}
      data-widget-id={instance.instanceId}
    >
      {editMode ? (
        <div className="workspace-widget__toolbar mb-2 flex flex-wrap items-center gap-1 rounded border border-dashed border-[var(--accent)]/50 bg-muted/40 px-2 py-1">
          <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-semibold">
            <LayoutGrid className="size-3" aria-hidden />
            {definition.label}
          </span>
          <div className="ml-auto flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onMove(-1)}>
              Op
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onMove(1)}>
              Ned
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={onToggleSpan}>
              {instance.span === "full" ? "Halv bredde" : "Fuld bredde"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={onHide}>
              Fjern
            </Button>
          </div>
        </div>
      ) : (
        <h2 className="wire-sec-title mb-3">{definition.label}</h2>
      )}
      <div className={cn(editMode && "opacity-95")}>{children}</div>
    </section>
  );
}
