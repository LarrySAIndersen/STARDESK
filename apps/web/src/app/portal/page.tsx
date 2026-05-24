import { cookies } from "next/headers";

import { EndUserTicketPortal } from "@/components/end-user-ticket-portal";
import { HelpdeskLoginPage } from "@/components/helpdesk-login/helpdesk-login-page";
import { TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export default async function PortalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return <HelpdeskLoginPage />;
  }

  const currentUser = await getServerUser();
  return <EndUserTicketPortal currentUser={currentUser} />;
}
