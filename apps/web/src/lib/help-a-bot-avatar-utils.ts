export type HelpABotAvatarId =
  | "robot"
  | "cat"
  | "dog"
  | "owl"
  | "fox"
  | "penguin"
  | "bear"
  | "frog"
  | "bunny"
  | "unicorn"
  | "dragon"
  | "fish"
  | "bee"
  | "octopus"
  | "rocket"
  | "star"
  | "coffee"
  | "lightbulb"
  | "ghost"
  | "alien";

export const HELP_A_BOT_AVATAR_IDS: readonly HelpABotAvatarId[] = [
  "robot",
  "cat",
  "dog",
  "owl",
  "fox",
  "penguin",
  "bear",
  "frog",
  "bunny",
  "unicorn",
  "dragon",
  "fish",
  "bee",
  "octopus",
  "rocket",
  "star",
  "coffee",
  "lightbulb",
  "ghost",
  "alien",
] as const;

export const PUPIL_OFFSET = 2.8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type MouseGaze = Readonly<{ x: number; y: number }>;

/** Normalized gaze vector from pointer relative to element center. */
export function computeMouseGaze(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
): MouseGaze {
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    return { x: 0, y: 0 };
  }

  const influence = Math.min(
    1,
    distance / (Math.max(viewportWidth, viewportHeight) * 0.35),
  );
  return {
    x: clamp((dx / distance) * influence, -1, 1),
    y: clamp((dy / distance) * influence, -1, 1),
  };
}

export function eyeOffset(
  baseX: number,
  baseY: number,
  gaze: MouseGaze,
  scale = 1,
): { cx: number; cy: number; hx: number; hy: number } {
  const ox = gaze.x * PUPIL_OFFSET * scale;
  const oy = gaze.y * PUPIL_OFFSET * scale;
  return {
    cx: baseX + ox,
    cy: baseY + oy,
    hx: baseX + ox - 1.5,
    hy: baseY + oy - 1.5,
  };
}

export function isValidHelpABotAvatarId(value: string): value is HelpABotAvatarId {
  return (HELP_A_BOT_AVATAR_IDS as readonly string[]).includes(value);
}
