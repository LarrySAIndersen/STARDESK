import { describe, expect, it } from "vitest";

import { blobToBase64 } from "@/lib/capture-review-screenshot";

describe("blobToBase64", () => {
  it("encodes blob bytes as base64", async () => {
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const encoded = await blobToBase64(blob);
    expect(atob(encoded)).toBe("\x89PNG");
  });
});
