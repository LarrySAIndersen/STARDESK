import { AvatarPresetIcon } from "@/components/agent/avatar-preset-icon";
import { resolveAvatarDisplay } from "@/lib/user-avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

export function UserAvatar({
  user,
  className,
  size = "sm",
}: {
  user: User | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const display = resolveAvatarDisplay(user);
  const sizeClass =
    size === "lg" ? "size-12 text-sm" : size === "md" ? "size-10 text-xs" : "size-7 text-[10px]";

  if (display.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic user avatar URLs (blob/external)
      <img
        src={display.src}
        alt={display.alt}
        className={cn(
          "wire-avatar-sm shrink-0 rounded-full object-cover p-0",
          sizeClass,
          className,
        )}
      />
    );
  }

  if (display.type === "preset") {
    return <AvatarPresetIcon presetId={display.presetId} className={className} size={size} />;
  }

  return (
    <span
      className={cn("wire-avatar-sm bg-[var(--star-navy-dark)]", sizeClass, className)}
      aria-hidden
    >
      {display.initials}
    </span>
  );
}
