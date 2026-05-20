import { redirect } from "next/navigation";

import { ServiceDeskView } from "@/components/service-desk/service-desk-view";
import { apiGetServer } from "@/lib/api-server";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { Ticket } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function ServiceDeskPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  let tickets: Ticket[] = [];
  try {
    tickets = await apiGetServer<Ticket[]>("/api/v1/tickets?board=true&limit=500");
  } catch {
    tickets = [];
  }

  return <ServiceDeskView tickets={tickets} />;
}
