import type { ReactNode } from "react";

import { ForbedringerSubnav } from "@/components/forbedringer/forbedringer-subnav";

export default function ForbedringerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-4">
      <div className="wire-card p-4 sm:p-5">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Forbedringer
        </p>
        <ForbedringerSubnav />
      </div>
      {children}
    </div>
  );
}
