"use client";

import { RotateCcw, X } from "lucide-react";
import { useState } from "react";

import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Edit-mode banner only — trigger lives in {@link PageLayoutEditTopBarControl}. */
export function PageLayoutEditToolbar() {
  const {
    canEdit,
    editMode,
    setEditMode,
    resetPageLayout,
    pageKey,
    undoLayout,
    canUndo,
    undoStackDepth,
  } = usePageLayoutEdit();
  const [command, setCommand] = useState("");

  if (!canEdit || !editMode) {
    return null;
  }

  function runCommand(raw: string) {
    const value = raw.trim().toLowerCase();
    if (value === "undo" || value === "fortryd") {
      undoLayout();
      setCommand("");
      return true;
    }
    return false;
  }

  return (
    <div className="page-layout-edit-banner" role="status">
      <p className="text-star-navy font-medium">
        Design-tilstand: flyt felter, omdøb, udvid/skjul. Gemmes lokalt (
        <code className="text-[10px]">{pageKey}</code>). Fortryd med knap, Ctrl+Z eller skriv{" "}
        <strong>undo</strong> nedenfor.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runCommand(command);
            }
          }}
          placeholder='Skriv "undo" og tryk Enter'
          className="h-8 max-w-[200px] bg-white text-[12px]"
          aria-label="Layout-kommando"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!canUndo}
          onClick={() => undoLayout()}
          title="Fortryd seneste ændring (Ctrl+Z)"
        >
          <RotateCcw className="mr-1 size-3.5" aria-hidden />
          Fortryd{undoStackDepth > 0 ? ` (${undoStackDepth})` : ""}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => resetPageLayout()}>
          Nulstil side
        </Button>
        <Button type="button" size="sm" onClick={() => setEditMode(false)}>
          <X className="mr-1 size-3.5" aria-hidden />
          Afslut design
        </Button>
      </div>
    </div>
  );
}
