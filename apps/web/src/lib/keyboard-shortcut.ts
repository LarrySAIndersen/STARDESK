export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (typeof el.tagName !== "string") return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(el.isContentEditable);
}
