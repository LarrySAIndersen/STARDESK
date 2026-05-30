"use client";

import { AttachmentRemoveButton } from "@/components/attachment-remove-button";
import { attachmentDownloadUrl } from "@/lib/api";
import type { Attachment } from "@/types/attachment";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function TicketCaseAttachments({
  ticketId,
  attachments,
  staffView,
}: {
  ticketId: string;
  attachments: Attachment[];
  staffView?: boolean;
}) {
  if (attachments.length === 0) {
    return (
      <section className="portal-v2-card p-4" aria-labelledby="attachments-heading">
        <h2 id="attachments-heading" className="portal-v2-section-title mb-2">
          Vedhæftninger
        </h2>
        <p className="text-muted-foreground text-[13px]">Ingen filer vedhæftet.</p>
      </section>
    );
  }

  return (
    <section className="portal-v2-card p-4" aria-labelledby="attachments-heading">
      <h2 id="attachments-heading" className="portal-v2-section-title mb-3">
        Vedhæftninger
      </h2>
      {staffView ? (
        <p className="text-muted-foreground mb-3 text-[12px]">
          Klik for at åbne eller hente filen.
        </p>
      ) : (
        <p className="text-muted-foreground mb-3 text-[12px]">
          Filer gennemgår virusscan. Download håndteres af sagsbehandler efter godkendelse.
        </p>
      )}
      <ul className="space-y-2">
        {attachments.map((file) => (
          <li
            key={file.id}
            className="border-border rounded-[2px] border px-3 py-2 text-[13px]"
          >
            {staffView && file.download_available ? (
              <a
                href={attachmentDownloadUrl(ticketId, file.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium hover:text-primary"
              >
                {file.filename}
              </a>
            ) : staffView && file.scan_status === "clean" && !file.file_retrievable ? (
              <p className="text-foreground font-medium">
                {file.filename}
                <span className="text-muted-foreground mt-0.5 block text-[11px] font-normal">
                  {file.file_unavailable_label_da ?? "Filen findes ikke længere — upload igen"}
                </span>
              </p>
            ) : (
              <p className="text-foreground font-medium">{file.filename}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-[11px]">
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
