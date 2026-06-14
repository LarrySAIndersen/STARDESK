import { writeUserCookie } from "@/lib/auth";
import type { ThemePalettePreference } from "@/lib/theme-palettes";
import type { User } from "@/types/user";

export async function saveUserThemePalette(
  preference: ThemePalettePreference,
): Promise<{ user: User } | { error: string }> {
  const response = await fetch("/api/auth/theme-palette", {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      preset_id: preference.preset_id,
      overrides: preference.overrides ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "Kunne ikke gemme farvetema";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // keep default
    }
    return { error: detail };
  }

  const payload = (await response.json()) as { user: User };
  writeUserCookie(payload.user);
  return { user: payload.user };
}
