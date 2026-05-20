import { PortalShellColumns } from "@/components/portal/portal-shell-columns";
import type { User } from "@/types/user";

export function PortalShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: User | null;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <PortalShellColumns user={user}>{children}</PortalShellColumns>
    </div>
  );
}
