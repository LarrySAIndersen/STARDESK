import { describe, expect, it, vi } from "vitest";

import { blobToBase64 } from "@/lib/capture-review-screenshot";

describe("blobToBase64", () => {
  it("encodes blob bytes as base64 via FileReader", async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL(_blob: Blob): void {
        this.result = "data:image/png;base64,iVBORw0KGgo=";
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }

    vi.stubGlobal("FileReader", MockFileReader);

    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const encoded = await blobToBase64(blob);
    expect(encoded).toBe("iVBORw0KGgo=");
  });
});
