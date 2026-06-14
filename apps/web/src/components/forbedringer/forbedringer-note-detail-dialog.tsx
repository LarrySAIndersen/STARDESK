"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ExternalLink, ImageIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AccessibleModalBackdrop,
  AccessibleModalPanel,
} from "@/components/ui/accessible-modal-shell";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { reviewNoteScreenshotUrl } from "@/lib/api";
import type { ReviewNote } from "@/types/review-note";

function formatTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat("da-DK", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function placementLabel(note: ReviewNote): string {
  return `x: ${Math.round(note.position_x)}, y: ${Math.round(note.position_y)}`;
}

function statusLabel(note: ReviewNote): string {
  if (note.status === "open") return "Åben";
  if (note.status === "resolved") return "Løst";
  return "Slettet";
}

function statusBadgeClass(note: ReviewNote): string {
  if (note.status === "open") {
    return "rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900";
  }
  if (note.status === "resolved") {
    return "bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-semibold";
  }
  return "rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700";
}

export function ForbedringerNoteDetailDialog({
  note,
  onClose,
  onResolve,
  onDelete,
}: Readonly<{
  note: ReviewNote;
  onClose: () => void;
  onResolve?: () => void;
  onDelete?: () => void;
}>) {
  const titleId = useId();
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const panelRef = useFocusTrap(true, onClose);
  const screenshotUrl = reviewNoteScreenshotUrl(note.id);

  return (
    <AccessibleModalBackdrop onClose={onClose}>
      <AccessibleModalPanel
        trapRef={panelRef}
        titleId={titleId}
        onClose={onClose}
        className="wire-confirm-modal max-h-[90vh] w-full max-w-3xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--gray-border)] px-4 py-3">
          <div className="min-w-0">
            <p id={titleId} className="wire-card-title text-lg">
              {note.review_number} · {note.page_title || note.page_path}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{note.page_path}</p>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
            aria-label="Luk"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="wire-scroll-content max-h-[calc(90vh-8rem)] space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusBadgeClass(note)}>{statusLabel(note)}</span>
            <Link
              href={note.page_path}
              className="text-star-blue inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Åbn side
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.comment}</p>

          <dl className="text-muted-foreground grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Person</dt>
              <dd>
                {note.created_by_name}
                {note.created_by_email ? ` (${note.created_by_email})` : ""}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Placering</dt>
              <dd>{placementLabel(note)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Oprettet</dt>
              <dd>{formatTimestamp(note.created_at)}</dd>
            </div>
          </dl>

          {note.has_screenshot ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-foreground text-sm font-medium">Skærmbillede</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPhotoExpanded((value) => !value)}
                >
                  <ImageIcon className="size-3.5" aria-hidden />
                  {photoExpanded ? "Vis mindre" : "Vis fuldt skærmbillede"}
                </Button>
              </div>
              <button
                type="button"
                className="border-input block w-full rounded-md border bg-muted/20 p-1 text-left"
                onClick={() => setPhotoExpanded((value) => !value)}
                aria-label="Vis skærmbillede i fuld størrelse"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotUrl}
                  alt={`Skærmbillede for ${note.page_title || note.page_path}`}
                  className={photoExpanded ? "max-h-[70vh] w-full object-contain" : "max-h-72 w-full object-contain"}
                />
              </button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Intet skærmbillede vedhæftet.</p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--gray-border)] px-4 py-3">
          {onDelete ? (
            <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
              Slet seddel
            </Button>
          ) : null}
          {note.status === "open" && onResolve ? (
            <Button type="button" size="sm" variant="outline" onClick={onResolve}>
              Markér som løst
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onClose}>
            Luk
          </Button>
        </div>
      </AccessibleModalPanel>
    </AccessibleModalBackdrop>
  );
}
