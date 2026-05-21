/** UI flow preference: modern STARdesk wireframe vs classic (TOPdesk-style) modules. */
export const UI_MODE_COOKIE = "stardesk_ui_mode";

export type UiMode = "modern" | "classic";

export function parseUiMode(raw: string | undefined | null): UiMode {
  return raw === "classic" ? "classic" : "modern";
}

export function classicHomePath(): string {
  return "/classic";
}

export function modernHomePath(): string {
  return "/";
}
