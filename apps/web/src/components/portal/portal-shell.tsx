import { PortalSidebar } from "@/components/portal/portal-sidebar";

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <PortalSidebar />
      <div className="wire-scroll-content min-h-0 flex-1">{children}</div>
    </div>
  );
}
