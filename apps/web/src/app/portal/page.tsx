import { EndUserTicketPortal } from "@/components/end-user-ticket-portal";
import { getServerUser } from "@/lib/auth-server";

export default async function PortalPreviewPage() {
  const currentUser = await getServerUser();

  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <EndUserTicketPortal currentUser={currentUser} />
    </div>
  );
}
