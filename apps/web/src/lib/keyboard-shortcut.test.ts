import { describe, expect, it } from "vitest";

import { isEditableKeyboardTarget } from "@/lib/keyboard-shortcut";

function mockElement(
  tag: string,
  contentEditable = false,
): EventTarget {
  return {
    tagName: tag.toUpperCase(),
    isContentEditable: contentEditable,
  } as unknown as HTMLElement;
}

describe("isEditableKeyboardTarget", () => {
  it("returns false for non-elements", () => {
    expect(isEditableKeyboardTarget(null)).toBe(false);
    expect(isEditableKeyboardTarget({} as EventTarget)).toBe(false);
  });

  it("detects input, textarea, select and contenteditable", () => {
    expect(isEditableKeyboardTarget(mockElement("input"))).toBe(true);
    expect(isEditableKeyboardTarget(mockElement("textarea"))).toBe(true);
    expect(isEditableKeyboardTarget(mockElement("select"))).toBe(true);
    expect(isEditableKeyboardTarget(mockElement("div", true))).toBe(true);
    expect(isEditableKeyboardTarget(mockElement("div"))).toBe(false);
  });
});
