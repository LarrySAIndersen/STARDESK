"use client";

import { AttachmentRemoveButton } from "@/components/attachment-remove-button";
import type { Attachment } from "@/types/attachment";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function PortalTicketAttachments({
  ticketId,
  attachments,
}: {
  ticketId: string;
  attachments: Attachment[];
}) {
  if (attachments.length === 0) {
    return (
      <section className="portal-v2-card p-4" aria-labelledby="attachments-heading">
        <h2 id="attachments-heading" className="portal-v2-section-title mb-2">
          Vedhæftninger
        </h2>
        <p className="text-[var(--gray-mid)] text-[13px]">Ingen filer vedhæftet.</p>
      </section>
    );
  }

  return (
    <section className="portal-v2-card p-4" aria-labelledby="attachments-heading">
      <h2 id="attachments-heading" className="portal-v2-section-title mb-3">
        Vedhæftninger
      </h2>
      <p className="text-[var(--gray-mid)] mb-3 text-[12px]">
        Filer gennemgår virusscan. Download håndteres af sagsbehandler efter godkendelse.
      </p>
      <ul className="space-y-2">
        {attachments.map((file) => (
          <li
            key={file.id}
            className="border-[var(--gray-border)] rounded-[2px] border px-3 py-2 text-[13px]"
          >
            <p className="text-foreground font-medium">{file.filename}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[var(--gray-mid)] text-[11px]">
                {file.scan_status_label_da}
                {file.scanned_at ? ` · ${formatDate(file.scanned_at)}` : null}
              </p>
              {file.can_delete ? (
                <AttachmentRemoveButton
                  ticketId={ticketId}
                  attachmentId={file.id}
                  filename={file.filename}
                  size="sm"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
