"use client";

import { ArrowLeft } from "lucide-react";

import { useNavigationBack } from "@/hooks/use-navigation-back";
import { cn } from "@/lib/utils";

type HistoryBackButtonProps = Readonly<{
  className?: string;
  /** Compact icon-only variant for dense headers (e.g. classic UI). */
  compact?: boolean;
}>;

export function HistoryBackButton({ className, compact = false }: HistoryBackButtonProps) {
  const { showBack, goBack } = useNavigationBack();

  if (!showBack) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        compact ? "nav-back-btn nav-back-btn--compact" : "nav-back-btn",
        className,
      )}
      aria-label="Tilbage til forrige side"
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      {compact ? null : <span>Tilbage</span>}
    </button>
  );
}
