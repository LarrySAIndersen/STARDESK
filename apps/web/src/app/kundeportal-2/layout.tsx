import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Kp2Shell } from "@/components/kundeportal-2/kp2-shell";
import { TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import { canAccessKundeportal2 } from "@/lib/kundeportal-2-access";

export const metadata = {
  title: "Kundeportal #2 - STAR Selvbetjening",
  description: "Alternativ selvbetjeningsportal for Service Requests and Changes",
};

export default async function Kundeportal2Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) {
    redirect("/login/helpdesk?next=/kundeportal-2");
  }

  const user = await getServerUser();
  if (!canAccessKundeportal2(user)) {
    redirect("/portal");
  }

  return <Kp2Shell>{children}</Kp2Shell>;
}
