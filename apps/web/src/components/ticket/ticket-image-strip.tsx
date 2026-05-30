"use client";

import { FileImage, ImagePlus, Paperclip, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import { AttachmentRemoveButton } from "@/components/attachment-remove-button";
import { buttonVariants } from "@/components/ui/button";
import { attachmentDownloadUrl } from "@/lib/api";
import { CLIPBOARD_IMAGE_PASTE_HINT } from "@/lib/clipboard-images";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/attachment";

function isImageAttachment(file: Attachment | File): boolean {
  const type = "content_type" in file ? file.content_type : file.type;
  return type.startsWith("image/");
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function collectImageFiles(data: DataTransfer): File[] {
  const out: File[] = [];
  if (data.files?.length) {
    for (let i = 0; i < data.files.length; i += 1) {
      const file = data.files.item(i);
      if (file && isImageAttachment(file)) {
        out.push(file);
      }
    }
  }
  return out;
}

export function TicketImageStrip({
  ticketId,
  attachments,
  pendingFiles,
  onAddFiles,
  onRemovePending,
  staffView,
  className,
}: {
  ticketId: string;
  attachments: Attachment[];
  pendingFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemovePending: (index: number) => void;
  staffView: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const imageAttachments = useMemo(
    () => attachments.filter(isImageAttachment),
    [attachments],
  );

  const pendingPreviews = useMemo(
    () =>
      pendingFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [pendingFiles],
  );

  useEffect(() => {
    return () => {
      for (const { url } of pendingPreviews) {
        URL.revokeObjectURL(url);
      }
    };
  }, [pendingPreviews]);

  const hasContent = imageAttachments.length > 0 || pendingFiles.length > 0;

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const dropped = collectImageFiles(event.dataTransfer);
      if (dropped.length > 0) {
        onAddFiles(dropped);
      }
    },
    [onAddFiles],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="wire-form-label mb-0">Billeder</p>
        <button
          type="button"
          className="text-star-blue hover:text-star-navy text-xs font-medium"
          onClick={() => inputRef.current?.click()}
        >
          Vælg filer
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files;
            if (chosen?.length) {
              onAddFiles([...chosen]);
            }
            event.target.value = "";
          }}
        />
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-md border border-dashed transition-colors",
          dragOver
            ? "border-star-blue bg-star-blue/5"
            : "border-[var(--gray-border)] bg-[var(--gray-soft)]/40",
          hasContent ? "p-2" : "px-3 py-4",
        )}
      >
        {hasContent ? (
          <ul className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
            {imageAttachments.map((file) => (
              <li
                key={file.id}
                className="border-input group relative size-[4.5rem] shrink-0 overflow-hidden rounded-md border bg-white"
                title={file.filename}
              >
                {staffView && file.download_available ? (
                  <a
                    href={attachmentDownloadUrl(ticketId, file.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block size-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachmentDownloadUrl(ticketId, file.id)}
                      alt={file.filename}
                      className="size-full object-cover"
                    />
                  </a>
                ) : staffView && file.scan_status === "clean" && !file.file_retrievable ? (
                  <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-0.5 p-1 text-center">
                    <FileImage className="size-5 shrink-0 opacity-40" aria-hidden />
                    <span className="line-clamp-3 text-[8px] leading-tight">
                      {file.file_unavailable_label_da ?? "Filen findes ikke længere"}
                    </span>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-0.5 p-1 text-center">
                    <FileImage className="size-5 shrink-0" aria-hidden />
                    <span className="line-clamp-2 text-[9px] leading-tight">{file.filename}</span>
                  </div>
                )}
                <span className="bg-star-navy/75 pointer-events-none absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[9px] text-white">
                  {formatDate(file.created_at)}
                </span>
                {file.can_delete ? (
                  <div className="absolute top-1 right-1 z-10">
                    <AttachmentRemoveButton
                      ticketId={ticketId}
                      attachmentId={file.id}
                      filename={file.filename}
                      variant="ghost"
                      iconOnly
                      className="[&_button]:bg-star-navy/80 [&_button]:hover:bg-star-navy [&_button]:size-6 [&_button]:p-0 [&_button]:text-white"
                    />
                  </div>
                ) : null}
              </li>
            ))}
            {pendingPreviews.map(({ file, url }, index) => (
              <li
                key={`pending-${file.name}-${file.size}-${index}`}
                className="border-star-blue relative size-[4.5rem] shrink-0 overflow-hidden rounded-md border-2 border-dashed bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={file.name} className="size-full object-cover" />
                <span className="bg-star-blue/90 absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[9px] text-white">
                  Ny
                </span>
                <button
                  type="button"
                  className="bg-star-navy/80 hover:bg-star-navy absolute top-1 right-1 rounded-full p-0.5 text-white"
                  aria-label={`Fjern ${file.name}`}
                  onClick={() => onRemovePending(index)}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
            <ImagePlus className="size-3.5 shrink-0" aria-hidden />
            Træk billeder hertil eller vælg filer · {CLIPBOARD_IMAGE_PASTE_HINT}
          </p>
        )}
      </div>

      {attachments.some((file) => !isImageAttachment(file)) ? (
        <ul className="flex flex-wrap gap-1.5">
          {attachments
            .filter((file) => !isImageAttachment(file))
            .map((file) => (
              <li key={file.id} className="flex items-center gap-1">
                {staffView && file.download_available ? (
                  <a
                    href={attachmentDownloadUrl(ticketId, file.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-7 gap-1 px-2 text-xs",
                    )}
                  >
                    <Paperclip className="size-3" aria-hidden />
                    {file.filename}
                  </a>
                ) : staffView && file.scan_status === "clean" && !file.file_retrievable ? (
                  <span
                    className="border-input text-muted-foreground inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs"
                    title={file.file_unavailable_label_da ?? undefined}
                  >
                    <Paperclip className="size-3" aria-hidden />
                    {file.filename}
                  </span>
                ) : (
                  <span className="border-input text-muted-foreground inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs">
                    <Paperclip className="size-3" aria-hidden />
                    {file.filename}
                  </span>
                )}
                {file.can_delete ? (
                  <AttachmentRemoveButton
                    ticketId={ticketId}
                    attachmentId={file.id}
                    filename={file.filename}
                    iconOnly
                  />
                ) : null}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
