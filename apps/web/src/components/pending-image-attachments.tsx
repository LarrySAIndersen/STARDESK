"use client";

import { ImagePlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ClipboardEvent } from "react";

import { extractImageFilesFromClipboard, CLIPBOARD_IMAGE_PASTE_HINT } from "@/lib/clipboard-images";

export function usePendingImageAttachments() {
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) {
      return;
    }
    setFiles((prev) => [...prev, ...incoming]);
  }, []);

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const pasted = extractImageFilesFromClipboard(event.clipboardData);
      if (pasted.length === 0) {
        return;
      }
      event.preventDefault();
      addFiles(pasted);
    },
    [addFiles],
  );

  const removeAt = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
  }, []);

  return { files, addFiles, onPaste, removeAt, clear, hasFiles: files.length > 0 };
}

export function PendingImageAttachments({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const { url } of previews) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previews]);

  if (files.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ImagePlus className="size-3.5 shrink-0" aria-hidden />
        {CLIPBOARD_IMAGE_PASTE_HINT}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        {files.length} billede{files.length === 1 ? "" : "r"} vedhæftet — gemmes på sagen ved Gem.
      </p>
      <ul className="flex flex-wrap gap-2">
        {previews.map(({ file, url }, index) => (
          <li
            key={`${file.name}-${file.size}-${index}`}
            className="border-input relative size-20 overflow-hidden rounded-md border bg-[var(--gray-soft)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={file.name} className="size-full object-cover" />
            <button
              type="button"
              className="bg-star-navy/80 hover:bg-star-navy absolute top-1 right-1 rounded-full p-0.5 text-white"
              aria-label={`Fjern ${file.name}`}
              onClick={() => onRemove(index)}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
