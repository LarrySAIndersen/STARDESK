import { PortalShell } from "@/components/portal/portal-shell";

export default function PortalV2Layout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
