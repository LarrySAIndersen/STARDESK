export type AvatarPreset = {
  id: string;
  label: string;
  /** Tailwind / CSS background for preset tile */
  bg: string;
  /** Accent for SVG icon */
  accent: string;
};

/** Generic superhero-style presets — STAR palette. */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "hero-star", label: "Stjernen", bg: "bg-star-navy", accent: "#E30613" },
  { id: "hero-bolt", label: "Lynet", bg: "bg-star-blue", accent: "#F5C518" },
  { id: "hero-shield", label: "Skjoldet", bg: "bg-[#1a2744]", accent: "#3B82F6" },
  { id: "hero-wing", label: "Vingen", bg: "bg-star-red", accent: "#FFFFFF" },
  { id: "hero-flame", label: "Flammen", bg: "bg-[#7c2d12]", accent: "#FDBA74" },
  { id: "hero-wave", label: "Bølgen", bg: "bg-[#0e7490]", accent: "#A5F3FC" },
  { id: "hero-nova", label: "Nova", bg: "bg-[#4c1d95]", accent: "#C4B5FD" },
  { id: "hero-orbit", label: "Orbit", bg: "bg-star-navy-dark", accent: "#60A5FA" },
  { id: "hero-beam", label: "Strålen", bg: "bg-[#b45309]", accent: "#FEF08A" },
  { id: "hero-comet", label: "Kometen", bg: "bg-[#134e4a]", accent: "#5EEAD4" },
];

export function isAvatarPresetId(id: string | null | undefined): id is string {
  if (!id) {
    return false;
  }
  return AVATAR_PRESETS.some((p) => p.id === id);
}

export function getAvatarPreset(id: string | null | undefined): AvatarPreset | null {
  return AVATAR_PRESETS.find((p) => p.id === id) ?? null;
}
