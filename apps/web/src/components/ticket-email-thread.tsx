"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  PendingImageAttachments,
  usePendingImageAttachments,
} from "@/components/pending-image-attachments";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { uploadTicketAttachments } from "@/lib/upload-ticket-attachments";
import type { TicketEmail } from "@/types/ticket";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function TicketEmailThread({
  ticketId,
  ticketNumber,
  linkedAddress,
  emails,
}: {
  ticketId: string;
  ticketNumber: string;
  linkedAddress?: string | null;
  emails: TicketEmail[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { files: pendingImages, onPaste, removeAt, clear, hasFiles } =
    usePendingImageAttachments();
  const canReply = emails.length > 0;
  const canSend = body.trim().length > 0 || hasFiles;

  const defaultRecipient = useMemo(() => {
    const lastInbound = [...emails].reverse().find((email) => email.direction === "inbound");
    return lastInbound?.from_email ?? "";
  }, [emails]);

  async function sendReply() {
    if (!canSend) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (pendingImages.length > 0) {
        await uploadTicketAttachments(ticketId, pendingImages);
      }
      const replyBody =
        body.trim() ||
        "(Vedhæftede billeder — se vedhæftninger på sagen)";
      await apiPost(`/api/v1/tickets/${ticketId}/email-reply`, {
        body: replyBody,
        to_email: toEmail.trim() || undefined,
      });
      setBody("");
      setToEmail("");
      clear();
      setNotice(`Svar sendt med sagsnummer ${ticketNumber}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke sende e-mail svar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-[var(--gray-border)] bg-[var(--gray-soft)] px-3 py-2 text-xs">
        Forbundet support-mail: <span className="font-semibold">{linkedAddress ?? "—"}</span>
      </div>
      {emails.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen e-mails er knyttet til denne sag endnu.</p>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <article key={email.id} className="rounded-sm border border-[var(--gray-border)] bg-white px-3 py-2 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{email.direction === "inbound" ? "Indgående" : "Udgående"}</span>
                <span className="text-muted-foreground">{formatDate(email.received_at)}</span>
              </div>
              <p>
                <span className="font-medium">Emne:</span> {email.subject ?? "—"}
              </p>
              <p>
                <span className="font-medium">Fra:</span> {email.from_email ?? "—"}
              </p>
              <p>
                <span className="font-medium">Til:</span> {email.to_email ?? "—"}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{email.body_text ?? ""}</p>
            </article>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t border-[var(--gray-border)] pt-4">
        <p className="wire-form-label">Svar på e-mail</p>
        <input
          type="email"
          className="wire-form-input h-9"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          placeholder={defaultRecipient || "kunde@firma.dk"}
        />
        <textarea
          className="wire-form-input min-h-28"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={onPaste}
          placeholder="Skriv svar til kunden..."
        />
        <PendingImageAttachments files={pendingImages} onRemove={removeAt} />
        <Button
          type="button"
          className="wire-btn wire-btn-primary"
          disabled={busy || !canSend || !canReply}
          onClick={() => void sendReply()}
        >
          {busy ? "Sender..." : "Send e-mail svar"}
        </Button>
        {!canReply ? (
          <p className="text-muted-foreground text-xs">
            Svar er først tilgængeligt, når sagen har en indgående Gmail-tråd.
          </p>
        ) : null}
        {notice ? (
          <p className="text-[11px] font-semibold text-[#1a7a44]" role="status">
            {notice}
          </p>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    </div>
  );
}
