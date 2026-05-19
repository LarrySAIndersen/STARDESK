import { getAvatarPreset } from "@/lib/avatar-presets";
import { cn } from "@/lib/utils";

function HeroGlyph({ presetId, accent }: { presetId: string; accent: string }) {
  const stroke = accent;
  const fill = accent;
  switch (presetId) {
    case "hero-bolt":
      return (
        <path
          d="M14 4 9 14h4l-2 10 9-14h-4l2-6Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="0.5"
        />
      );
    case "hero-shield":
      return (
        <path
          d="M16 5 10 7v6c0 4 3 6 6 8 3-2 6-4 6-8V7l-6-2Z"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />
      );
    case "hero-wing":
      return (
        <path
          d="M6 18c4-8 8-10 10-12 2 2 4 6 4 10M18 18c-4-8-8-10-10-12-2 2-4 6-4 10"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      );
    case "hero-flame":
      return (
        <path
          d="M16 20c-4-2-6-6-4-10 2 2 2 4 0 6-2-4 0-6 2-2 4 0 6 2 2 4 4 4Z"
          fill={fill}
          opacity="0.9"
        />
      );
    case "hero-wave":
      return (
        <path
          d="M6 14c2-2 4-2 6 0s4 2 6 0M6 18c2-2 4-2 6 0s4 2 6 0"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      );
    case "hero-nova":
      return (
        <>
          <circle cx="16" cy="16" r="5" fill={fill} opacity="0.35" />
          <path d="M16 6v4M16 22v4M6 16h4M22 16h4M9 9l3 3M20 20l3 3M23 9l-3 3M9 23l-3-3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case "hero-orbit":
      return (
        <>
          <circle cx="16" cy="16" r="7" fill="none" stroke={stroke} strokeWidth="1.5" />
          <circle cx="22" cy="12" r="2.5" fill={fill} />
        </>
      );
    case "hero-beam":
      return (
        <path d="M8 22 16 6l8 16H8Z" fill="none" stroke={stroke} strokeWidth="1.5" />
      );
    case "hero-comet":
      return (
        <>
          <circle cx="20" cy="12" r="3" fill={fill} />
          <path d="M4 20 14 14" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "hero-star":
    default:
      return (
        <path
          d="M16 6 18 13h7l-5.5 4 2 7L16 20l-5.5 4 2-7L7 13h7l2-7Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="0.5"
        />
      );
  }
}

export function AvatarPresetIcon({
  presetId,
  className,
  size = "sm",
}: {
  presetId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const preset = getAvatarPreset(presetId);
  const accent = preset?.accent ?? "#FFFFFF";
  const sizeClass =
    size === "lg" ? "size-12 text-base" : size === "md" ? "size-10" : "size-7 text-[10px]";

  return (
    <span
      className={cn(
        "wire-avatar-sm flex shrink-0 items-center justify-center overflow-hidden p-0.5",
        preset?.bg ?? "bg-star-navy",
        sizeClass,
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-[85%]" aria-hidden>
        <HeroGlyph presetId={presetId} accent={accent} />
      </svg>
    </span>
  );
}
