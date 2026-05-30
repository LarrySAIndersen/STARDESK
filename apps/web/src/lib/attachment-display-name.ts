import type { Attachment } from "@/types/attachment";

function extensionFromAttachment(attachment: Attachment): string {
  const fromName = attachment.filename.includes(".")
    ? attachment.filename.slice(attachment.filename.lastIndexOf("."))
    : "";
  if (fromName) {
    return fromName.toLowerCase();
  }
  if (attachment.content_type === "image/jpeg") return ".jpg";
  if (attachment.content_type === "image/png") return ".png";
  if (attachment.content_type === "image/gif") return ".gif";
  if (attachment.content_type === "image/webp") return ".webp";
  if (attachment.content_type === "application/pdf") return ".pdf";
  return ".bin";
}

/** Display/download label: {ticket_number}-{YYYYMMDD-HHmmss}.{ext} */
export function attachmentDisplayName(
  ticketNumber: string,
  attachment: Attachment,
): string {
  const safeNumber = ticketNumber.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "sag";
  const stamp = formatAttachmentStamp(attachment.created_at);
  return `${safeNumber}-${stamp}${extensionFromAttachment(attachment)}`;
}

function formatAttachmentStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function isImageAttachment(attachment: Attachment): boolean {
  return attachment.content_type.startsWith("image/");
}
