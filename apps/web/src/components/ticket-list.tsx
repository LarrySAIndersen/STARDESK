import { AgentHome } from "@/components/agent-home";
import { EndUserTicketPortal } from "@/components/end-user-ticket-portal";
import { isStaff, USER_COOKIE } from "@/lib/auth";
import type { User } from "@/types/user";
import { cookies } from "next/headers";

export async function TicketList() {
  let currentUser: User | null = null;

  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  if (isStaff(currentUser)) {
    return <AgentHome />;
  }

  return <EndUserTicketPortal currentUser={currentUser} />;
}
