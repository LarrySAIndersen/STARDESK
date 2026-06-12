import { describe, expect, it } from "vitest";

import {
  clamp,
  computeMouseGaze,
  eyeOffset,
  isValidHelpABotAvatarId,
  PUPIL_OFFSET,
} from "@/lib/help-a-bot-avatar-utils";

describe("help-a-bot-avatar-utils", () => {
  it("clamps values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("computes gaze from pointer position", () => {
    const gaze = computeMouseGaze(
      150,
      100,
      { left: 100, top: 50, width: 40, height: 40 },
      1000,
      800,
    );
    expect(gaze.x).toBeGreaterThan(0);
    expect(gaze.y).toBeGreaterThan(0);
    expect(gaze.x).toBeLessThanOrEqual(1);
  });

  it("returns zero gaze near center", () => {
    expect(
      computeMouseGaze(120, 70, { left: 100, top: 50, width: 40, height: 40 }, 1000, 800),
    ).toEqual({ x: 0, y: 0 });
  });

  it("offsets eyes with pupil constant", () => {
    const gaze = { x: 1, y: -0.5 };
    const pos = eyeOffset(10, 12, gaze, 2);
    expect(pos.cx).toBe(10 + PUPIL_OFFSET * 2);
    expect(pos.cy).toBe(12 - PUPIL_OFFSET);
  });

  it("validates avatar ids", () => {
    expect(isValidHelpABotAvatarId("robot")).toBe(true);
    expect(isValidHelpABotAvatarId("invalid")).toBe(false);
  });
});
