"use client";

import { ChevronDown, ChevronUp, Minimize2, Maximize2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PageLayoutFieldSpan } from "@/lib/page-layout/types";

export function PageLayoutGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { editMode } = usePageLayoutEdit();
  return (
    <div
      className={cn(
        "page-layout-grid flex flex-col",
        editMode && "page-layout-grid--edit gap-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageLayoutField({
  fieldId,
  defaultLabel,
  defaultOrder,
  defaultSpan = "full",
  children,
  className,
}: {
  fieldId: string;
  defaultLabel: string;
  defaultOrder: number;
  defaultSpan?: PageLayoutFieldSpan;
  children: ReactNode;
  className?: string;
}) {
  const { editMode, getField, updateField, moveField } = usePageLayoutEdit();
  const config = getField(fieldId, {
    label: defaultLabel,
    order: defaultOrder,
    span: defaultSpan,
  });
  const [labelDraft, setLabelDraft] = useState(config.label);

  useEffect(() => {
    setLabelDraft(config.label);
  }, [config.label]);

  if (config.collapsed && !editMode) {
    return null;
  }

  return (
    <div
      className={cn(
        "page-layout-field",
        config.span === "half" && "page-layout-field--half",
        editMode && "page-layout-field--editing",
        className,
      )}
      style={{ order: config.order }}
      data-field-id={fieldId}
    >
      {editMode ? (
        <div className="page-layout-field__toolbar mb-1 flex flex-wrap items-center gap-1 rounded border border-dashed border-[var(--accent)]/50 bg-muted/40 px-2 py-1">
          <input
            type="text"
            value={labelDraft}
            onChange={(event) => setLabelDraft(event.target.value)}
            onBlur={() => {
              if (labelDraft.trim() && labelDraft !== config.label) {
                updateField(fieldId, { label: labelDraft.trim() });
              }
            }}
            className="min-w-[6rem] flex-1 rounded border border-border bg-background px-2 py-0.5 text-[11px]"
            aria-label={`Feltnavn for ${fieldId}`}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            title="Flyt op"
            onClick={() => moveField(fieldId, -1)}
          >
            <ChevronUp className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            title="Flyt ned"
            onClick={() => moveField(fieldId, 1)}
          >
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            title={config.span === "full" ? "Gør smal" : "Gør bred"}
            onClick={() =>
              updateField(fieldId, { span: config.span === "full" ? "half" : "full" })
            }
          >
            {config.span === "full" ? (
              <Minimize2 className="size-3.5" aria-hidden />
            ) : (
              <Maximize2 className="size-3.5" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5 text-[10px]"
            onClick={() => updateField(fieldId, { collapsed: !config.collapsed })}
          >
            {config.collapsed ? "Vis" : "Skjul"}
          </Button>
        </div>
      ) : null}
      <div className={cn(config.collapsed && editMode && "opacity-40")}>{children}</div>
    </div>
  );
}

/** Form field with layout-editable label (Ny sag m.fl.). */
export function PageLayoutFormField({
  fieldId,
  defaultLabel,
  defaultOrder,
  defaultSpan = "full",
  htmlFor,
  children,
  className,
}: {
  fieldId: string;
  defaultLabel: string;
  defaultOrder: number;
  defaultSpan?: PageLayoutFieldSpan;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const { getField } = usePageLayoutEdit();
  const label = getField(fieldId, {
    label: defaultLabel,
    order: defaultOrder,
    span: defaultSpan,
  }).label;

  return (
    <PageLayoutField
      fieldId={fieldId}
      defaultLabel={defaultLabel}
      defaultOrder={defaultOrder}
      defaultSpan={defaultSpan}
      className={className}
    >
      <div className="space-y-2">
        {htmlFor ? (
          <label className="wire-form-label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <p className="wire-form-label mb-0">{label}</p>
        )}
        {children}
      </div>
    </PageLayoutField>
  );
}

/** Section block with layout-editable heading. */
export function PageLayoutSection({
  fieldId,
  defaultLabel,
  defaultOrder,
  children,
  className,
  contentClassName,
}: {
  fieldId: string;
  defaultLabel: string;
  defaultOrder: number;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const { getField } = usePageLayoutEdit();
  const label = getField(fieldId, { label: defaultLabel, order: defaultOrder }).label;

  return (
    <PageLayoutField
      fieldId={fieldId}
      defaultLabel={defaultLabel}
      defaultOrder={defaultOrder}
      className={className}
    >
      <section className={cn("space-y-4", contentClassName)}>
        <h2 className="wire-card-title">{label}</h2>
        {children}
      </section>
    </PageLayoutField>
  );
}
