const REVIEW_CAPTURE_HIDE_SELECTORS = [
  ".review-notes-layer",
  ".review-notes-toolbar",
  ".review-note-composer",
  ".review-note-popover",
] as const;

const CAPTURE_DEFER_MS = 80;

function hideReviewUi(): HTMLElement[] {
  const hidden: HTMLElement[] = [];
  for (const selector of REVIEW_CAPTURE_HIDE_SELECTORS) {
    document.querySelectorAll(selector).forEach((node) => {
      const element = node as HTMLElement;
      if (element.style.visibility === "hidden") {
        return;
      }
      hidden.push(element);
      element.style.visibility = "hidden";
    });
  }
  return hidden;
}

function restoreReviewUi(hidden: HTMLElement[]): void {
  for (const element of hidden) {
    element.style.visibility = "";
  }
}

function shouldIgnoreCaptureElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  return (
    element.classList.contains("review-notes-layer") ||
    element.classList.contains("review-notes-toolbar") ||
    element.classList.contains("review-note-composer") ||
    element.classList.contains("review-note-popover")
  );
}

async function loadHtml2Canvas() {
  const importedHtml2Canvas = await import("html2canvas");
  return importedHtml2Canvas.default;
}

async function captureTargetToPngBlob(target: HTMLElement): Promise<Blob | null> {
  const html2canvas = await loadHtml2Canvas();
  const scale = Math.min(window.devicePixelRatio || 1, 1.25);
  const canvas = await html2canvas(target, {
    logging: false,
    useCORS: true,
    scale,
    ignoreElements: shouldIgnoreCaptureElement,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.clientWidth,
    windowHeight: document.documentElement.clientHeight,
  });

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.85);
  });
}

function captureRootElement(): HTMLElement | null {
  return document.getElementById("main-content") ?? document.body;
}

/** Capture the current viewport as PNG, hiding review overlay UI first. */
export async function captureReviewScreenshot(): Promise<Blob | null> {
  if (typeof document === "undefined") {
    return null;
  }

  const target = captureRootElement();
  if (!target) {
    return null;
  }

  const hidden = hideReviewUi();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  try {
    return await captureTargetToPngBlob(target);
  } catch {
    return null;
  } finally {
    restoreReviewUi(hidden);
  }
}

/** Defer capture so click handlers can paint UI before heavy work starts. */
export function scheduleReviewScreenshotCapture(
  onCaptured: (blob: Blob | null) => void,
): () => void {
  let cancelled = false;

  const runCapture = () => {
    if (cancelled) {
      return;
    }
    void captureReviewScreenshot().then((blob) => {
      if (!cancelled) {
        onCaptured(blob);
      }
    });
  };

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(runCapture, { timeout: 2_000 });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(idleId);
    };
  }

  const timer = window.setTimeout(runCapture, CAPTURE_DEFER_MS);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("Failed to encode screenshot"));
        return;
      }
      const commaIndex = dataUrl.indexOf(",");
      resolve(commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read screenshot"));
    };
    reader.readAsDataURL(blob);
  });
}
