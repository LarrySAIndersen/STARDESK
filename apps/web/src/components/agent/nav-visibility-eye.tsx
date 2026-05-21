"use client";

import { Eye } from "lucide-react";

import { cn } from "@/lib/utils";

export function NavVisibilityEye({
  hidden,
  collapsed,
  onToggle,
}: {
  hidden: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return null;
  }

  return (
    <button
      type="button"
      className={cn(
        "ml-auto shrink-0 rounded p-0.5 transition-colors",
        hidden
          ? "text-[#c41e2a] hover:bg-[#fde8ea] hover:text-[#9a1822]"
          : "text-[#1a7a44] hover:bg-[#e6f5ec] hover:text-[#146b38]",
      )}
      title={
        hidden
          ? "Skjult for andre — klik for at vise for alle"
          : "Synlig for alle — klik for at skjule for andre"
      }
      aria-label={hidden ? "Vis menupunkt for andre brugere" : "Skjul menupunkt for andre brugere"}
      aria-pressed={hidden}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <Eye className="size-3.5" aria-hidden />
    </button>
  );
}
