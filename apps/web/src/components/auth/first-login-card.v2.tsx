import { Info } from "lucide-react";

import { StarLogo } from "@/components/star-logo";
import { cn } from "@/lib/utils";

export function FirstLoginCardV2({
  title,
  subtitle,
  infoText,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  infoText: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[420px] rounded-xl border border-white/[0.08] bg-[#111827] p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <StarLogo priority inverted markSize={48} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">{subtitle}</p>
      </div>

      <div
        className="mb-6 flex gap-3 rounded-lg border-l-4 border-[#3b82f6] bg-[rgba(59,130,246,0.08)] px-3 py-3 text-sm leading-snug text-[#cbd5e1]"
        role="status"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-[#60a5fa]" aria-hidden />
        <span>{infoText}</span>
      </div>

      {children}
    </div>
  );
}
