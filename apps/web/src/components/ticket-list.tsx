import { AgentHome } from "@/components/agent-home";
import { EndUserTicketPortal } from "@/components/end-user-ticket-portal";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";

export async function TicketList() {
  const currentUser = await getServerUser();

  if (isStaff(currentUser)) {
    return <AgentHome />;
  }

  return <EndUserTicketPortal currentUser={currentUser} />;
}
