import { PortalShell } from "@/components/portal/portal-shell";
import { getServerUser } from "@/lib/auth-server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  return <PortalShell user={user}>{children}</PortalShell>;
}
