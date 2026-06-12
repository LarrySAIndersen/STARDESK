import { describe, expect, it } from "vitest";

import { attachmentDisplayName, isImageAttachment } from "./attachment-display-name";
import type { Attachment } from "@/types/attachment";

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: "att-1",
    filename: "scan.pdf",
    content_type: "application/pdf",
    size_bytes: 100,
    scan_status: "clean",
    scan_status_label_da: "Ren",
    scanned_at: null,
    created_at: "2026-06-10T14:30:45.000Z",
    download_available: true,
    file_retrievable: true,
    file_unavailable_label_da: null,
    can_delete: true,
    ...overrides,
  };
}

describe("attachmentDisplayName", () => {
  it("builds ticket-stamped filename with extension from name", () => {
    const name = attachmentDisplayName("INC-001", makeAttachment());
    expect(name).toMatch(/^INC-001-\d{8}-\d{6}\.pdf$/);
  });

  it("sanitizes unsafe ticket numbers and infers extension from content type", () => {
    const name = attachmentDisplayName("bad/num", makeAttachment({
      filename: "photo",
      content_type: "image/png",
    }));
    expect(name).toMatch(/^bad-num-\d{8}-\d{6}\.png$/);
  });

  it("falls back to .bin when type is unknown", () => {
    const name = attachmentDisplayName("X", makeAttachment({
      filename: "blob",
      content_type: "application/octet-stream",
    }));
    expect(name.endsWith(".bin")).toBe(true);
  });
});

describe("isImageAttachment", () => {
  it("detects image content types", () => {
    expect(isImageAttachment(makeAttachment({ content_type: "image/jpeg" }))).toBe(true);
    expect(isImageAttachment(makeAttachment({ content_type: "application/pdf" }))).toBe(false);
  });
});
