import { Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StarmeetComingSoonButton({
  className,
  size = "sm",
  onPointerDown,
}: Readonly<{
  className?: string;
  size?: "sm" | "icon";
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
}>) {
  if (size === "icon") {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("team-chat-starmeet-btn size-8 shrink-0", className)}
        disabled
        aria-label="STARmeet — kommer snart"
        title="STARmeet — kommer snart"
        onPointerDown={onPointerDown}
      >
        <Video className="size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("team-chat-starmeet-btn shrink-0", className)}
      disabled
      aria-label="STARmeet — kommer snart"
      title="STARmeet — kommer snart"
    >
      <Video className="size-4" aria-hidden />
      STARmeet
      <span className="team-chat-starmeet-soon">(kommer snart)</span>
    </Button>
  );
}
