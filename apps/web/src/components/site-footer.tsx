type SiteFooterProps = Readonly<{
  variant?: "default" | "firstLoginIndustrial";
}>;

export function SiteFooter({ variant = "default" }: SiteFooterProps) {
  if (variant === "firstLoginIndustrial") {
    return (
      <footer className="mt-auto border-t border-white/[0.08] bg-[#0a0e1a]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-[#64748b]">
          <p>
            <span className="font-medium text-[#94a3b8]">STARdesk</span> — prototype for STAR ITSM
          </p>
          <p className="text-xs text-[#64748b]">
            Design inspireret af star.dk
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-star-navy mt-16 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm">
        <p className="text-white/90">
          <span className="font-semibold">STARdesk</span> — prototype for STAR ITSM
        </p>
        <p className="text-white/85 text-xs">
          Design inspireret af star.dk
        </p>
      </div>
    </footer>
  );
}
