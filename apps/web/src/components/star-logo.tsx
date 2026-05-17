import Image from "next/image";

import { cn } from "@/lib/utils";

const LOGO_WIDTH = 413;
const LOGO_HEIGHT = 111;

const ALT = "Styrelsen for Arbejdsmarked og Rekruttering";

export function StarLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/images/star-logo.png"
      alt={ALT}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={cn("h-9 w-auto shrink-0 sm:h-10", className)}
      priority={priority}
    />
  );
}
