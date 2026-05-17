"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { attachmentDownloadUrl } from "@/lib/api";
import { getClientToken } from "@/lib/auth";
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (attachments.length === 0) {
    return null;
  }

  async function download(attachment: Attachment) {
    if (!attachment.download_available) {
      return;
    }
    setDownloadingId(attachment.id);
    try {
      const token = getClientToken();
      const response = await fetch(attachmentDownloadUrl(ticketId, attachment.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error("Kunne ikke hente filen");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
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
              {staffView && file.download_available ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={downloadingId === file.id}
                  onClick={() => download(file)}
                >
                  {downloadingId === file.id ? "Henter…" : "Åbn"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
