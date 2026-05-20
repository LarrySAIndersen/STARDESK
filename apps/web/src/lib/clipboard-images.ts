/** Extract image files from a clipboard paste event. */
export function extractImageFilesFromClipboard(data: DataTransfer): File[] {
  const files: File[] = [];
  for (let i = 0; i < data.items.length; i += 1) {
    const item = data.items[i];
    if (item.kind !== "file" || !item.type.startsWith("image/")) {
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      files.push(normalizeClipboardImageFile(file, files.length));
    }
  }
  return files;
}

function normalizeClipboardImageFile(file: File, index: number): File {
  const hasName = file.name && file.name.trim().length > 0 && !file.name.startsWith("blob");
  if (hasName) {
    return file;
  }
  const subtype = file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
  const ext = subtype === "jpeg" ? "jpg" : subtype;
  return new File([file], `indsat-billede-${Date.now()}-${index + 1}.${ext}`, {
    type: file.type || "image/png",
  });
}

export const CLIPBOARD_IMAGE_PASTE_HINT =
  "Du kan indsætte billeder fra udklipsholder med Ctrl+V.";
