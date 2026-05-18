import { EndUserTicketPortal } from "@/components/end-user-ticket-portal";
import { getServerUser } from "@/lib/auth-server";

export default async function PortalPreviewPage() {
  const currentUser = await getServerUser();

  return <EndUserTicketPortal currentUser={currentUser} />;
}
