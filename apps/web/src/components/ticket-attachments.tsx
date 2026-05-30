"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AttachmentRemoveButton } from "@/components/attachment-remove-button";
import { attachmentDownloadUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/attachment";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function TicketAttachments({
  ticketId,
  attachments,
  staffView,
}: {
  ticketId: string;
  attachments: Attachment[];
  staffView: boolean;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vedhæftninger</CardTitle>
        <CardDescription>
          {staffView
            ? "Kun synlig for sagsbehandlere og andre aktører — ikke for andre indmeldere i kundeportalen."
            : "Dine uploadede dokumenter gennemgår virusscan før de kan bruges af sagsbehandling."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="border-input flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{file.filename}</p>
                <p className="text-muted-foreground text-xs">
                  {file.scan_status_label_da}
                  {file.scanned_at ? ` · ${formatDate(file.scanned_at)}` : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {staffView && file.download_available ? (
                  <a
                    href={attachmentDownloadUrl(ticketId, file.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Åbn
                  </a>
                ) : staffView && file.scan_status === "clean" && !file.file_retrievable ? (
                  <span className="text-muted-foreground text-xs">
                    {file.file_unavailable_label_da ?? "Filen findes ikke længere — upload igen"}
                  </span>
                ) : null}
                {file.can_delete ? (
                  <AttachmentRemoveButton
                    ticketId={ticketId}
                    attachmentId={file.id}
                    filename={file.filename}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
