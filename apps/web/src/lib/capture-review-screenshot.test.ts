import { afterEach, describe, expect, it, vi } from "vitest";

import {
  blobToBase64,
  scheduleReviewScreenshotCapture,
  shouldIgnoreCaptureElement,
} from "@/lib/capture-review-screenshot";

describe("shouldIgnoreCaptureElement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores review overlay nodes", () => {
    class MockHTMLElement {
      classList = { contains: () => false };
    }
    vi.stubGlobal("HTMLElement", MockHTMLElement);

    const overlay = new MockHTMLElement();
    overlay.classList = {
      contains: (...names: string[]) => names.includes("review-notes-layer"),
    };
    expect(shouldIgnoreCaptureElement(overlay as unknown as Element)).toBe(true);

    const plain = new MockHTMLElement();
    expect(shouldIgnoreCaptureElement(plain as unknown as Element)).toBe(false);
    expect(shouldIgnoreCaptureElement({} as Element)).toBe(false);
  });
});

describe("scheduleReviewScreenshotCapture", () => {
  it("returns cancel handler without invoking capture immediately", () => {
    vi.stubGlobal("window", {
      requestIdleCallback: undefined,
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    const onCaptured = vi.fn();
    const cancel = scheduleReviewScreenshotCapture(onCaptured);
    expect(onCaptured).not.toHaveBeenCalled();
    cancel();
    expect(window.clearTimeout).toHaveBeenCalledWith(1);
    vi.unstubAllGlobals();
  });
});

describe("blobToBase64", () => {
  it("encodes blob bytes as base64 via FileReader", async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL(blob: Blob): void {
        void blob;
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
