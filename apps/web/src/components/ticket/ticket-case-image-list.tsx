"use client";

import { AttachmentRemoveButton } from "@/components/attachment-remove-button";
import {
  attachmentDisplayName,
  isImageAttachment,
} from "@/lib/attachment-display-name";
import { attachmentDownloadUrl } from "@/lib/api";
import type { Attachment } from "@/types/attachment";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function TicketCaseImageList({
  ticketId,
  ticketNumber,
  attachments,
  staffView,
}: {
  ticketId: string;
  ticketNumber: string;
  attachments: Attachment[];
  staffView?: boolean;
}) {
  const images = attachments.filter(isImageAttachment);
  const otherFiles = attachments.filter((a) => !isImageAttachment(a));

  if (attachments.length === 0) {
    return (
      <p className="text-muted-foreground text-[13px]">Ingen billeder eller filer endnu.</p>
    );
  }

  return (
    <div className="space-y-4">
      {images.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Billeder på sagen">
          {images.map((file) => {
            const label = attachmentDisplayName(ticketNumber, file);
            const canOpen = file.download_available;
            return (
              <li
                key={file.id}
                className="border-border flex flex-col gap-2 rounded-[2px] border p-3 sm:flex-row sm:items-start"
              >
                {canOpen ? (
                  <a
                    href={attachmentDownloadUrl(ticketId, file.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-muted/40 block shrink-0 overflow-hidden rounded-[2px] border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachmentDownloadUrl(ticketId, file.id)}
                      alt={label}
                      className="max-h-40 w-full max-w-[220px] object-contain sm:w-[220px]"
                    />
                  </a>
                ) : (
                  <div className="bg-muted/40 text-muted-foreground flex max-h-40 min-h-[80px] w-full max-w-[220px] items-center justify-center rounded-[2px] border text-[11px] sm:w-[220px]">
                    {file.scan_status_label_da}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {canOpen ? (
                    <a
                      href={attachmentDownloadUrl(ticketId, file.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground block text-[13px] font-medium break-all hover:text-primary"
                    >
                      {label}
                    </a>
                  ) : (
                    <p className="text-foreground text-[13px] font-medium break-all">{label}</p>
                  )}
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {file.scan_status_label_da}
                    {file.scanned_at ? ` · ${formatDate(file.scanned_at)}` : null}
                  </p>
                  {staffView && file.scan_status === "clean" && !file.file_retrievable ? (
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {file.file_unavailable_label_da ?? "Filen findes ikke længere — upload igen"}
                    </p>
                  ) : null}
                  {file.can_delete ? (
                    <div className="mt-2">
                      <AttachmentRemoveButton
                        ticketId={ticketId}
                        attachmentId={file.id}
                        filename={label}
                        size="sm"
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {otherFiles.length > 0 ? (
        <div>
          <p className="text-muted-foreground mb-2 text-[12px] font-medium">Andre filer</p>
          <ul className="space-y-2">
            {otherFiles.map((file) => {
              const label = attachmentDisplayName(ticketNumber, file);
              return (
                <li
                  key={file.id}
                  className="border-border rounded-[2px] border px-3 py-2 text-[13px]"
                >
                  {file.download_available ? (
                    <a
                      href={attachmentDownloadUrl(ticketId, file.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground font-medium hover:text-primary"
                    >
                      {label}
                    </a>
                  ) : (
                    <p className="text-foreground font-medium">{label}</p>
                  )}
                  {file.can_delete ? (
                    <div className="mt-2">
                      <AttachmentRemoveButton
                        ticketId={ticketId}
                        attachmentId={file.id}
                        filename={label}
                        size="sm"
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
