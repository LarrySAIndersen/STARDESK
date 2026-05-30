"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteTicketAttachment } from "@/lib/delete-ticket-attachment";
import { cn } from "@/lib/utils";

export function AttachmentRemoveButton({
  ticketId,
  attachmentId,
  filename,
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: {
  ticketId: string;
  attachmentId: string;
  filename: string;
  variant?: "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    const ok = globalThis.confirm?.(
      `Fjern vedhæftningen «${filename}» fra sagen? Dette kan ikke fortrydes.`,
    );
    if (!ok) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteTicketAttachment(ticketId, attachmentId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke fjerne vedhæftningen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex flex-col items-end gap-0.5", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={busy}
        onClick={() => void handleRemove()}
        aria-label={`Fjern ${filename}`}
        title="Fjern vedhæftning"
      >
        {iconOnly ? (
          <Trash2 className="size-3.5" aria-hidden />
        ) : (
          <>
            <Trash2 className="size-3.5" aria-hidden />
            Fjern
          </>
        )}
      </Button>
      {error ? (
        <span className="text-destructive max-w-[12rem] text-right text-[10px] leading-tight">
          {error}
        </span>
      ) : null}
    </span>
  );
}
