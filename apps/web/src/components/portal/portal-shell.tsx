import { PortalShellColumns } from "@/components/portal/portal-shell-columns";

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <PortalShellColumns>{children}</PortalShellColumns>
    </div>
  );
}
