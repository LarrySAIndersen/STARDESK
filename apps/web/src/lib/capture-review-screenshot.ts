const REVIEW_CAPTURE_HIDE_SELECTORS = [
  ".review-notes-layer",
  ".review-notes-toolbar",
  ".review-note-composer",
  ".review-note-popover",
] as const;

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

function cloneWithInlineStyles(source: Element): HTMLElement {
  if (!(source instanceof HTMLElement)) {
    return source.cloneNode(true) as HTMLElement;
  }

  const clone = source.cloneNode(false) as HTMLElement;
  const computed = window.getComputedStyle(source);
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    clone.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }

  for (const child of source.childNodes) {
    if (child instanceof Element) {
      clone.appendChild(cloneWithInlineStyles(child));
    } else {
      clone.appendChild(child.cloneNode(true));
    }
  }

  return clone;
}

async function elementToPngBlob(element: HTMLElement): Promise<Blob | null> {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const clone = cloneWithInlineStyles(element);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.transform = `translate(${-scrollX}px, ${-scrollY}px)`;
  clone.style.transformOrigin = "top left";

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = "hidden";
  wrapper.appendChild(clone);

  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        ${new XMLSerializer().serializeToString(wrapper)}
      </foreignObject>
    </svg>`;

  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Screenshot render failed"));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.92);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Capture the current viewport as PNG, hiding review overlay UI first. */
export async function captureReviewScreenshot(): Promise<Blob | null> {
  if (typeof document === "undefined") {
    return null;
  }

  const hidden = hideReviewUi();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  try {
    return await elementToPngBlob(document.body);
  } finally {
    restoreReviewUi(hidden);
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}
