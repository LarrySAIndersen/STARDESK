import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Source_Sans_3 } from "next/font/google";

import { Kp2Shell } from "@/components/kundeportal-2/kp2-shell";
import { PortalShell } from "@/components/portal/portal-shell";
import { TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import { canAccessKundeportal2 } from "@/lib/kundeportal-2-access";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-helpdesk-sans",
});

export const metadata: Metadata = {
  title: "Kundeportal #2 — STAR Selvbetjening",
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

  return (
    <div
      className={`${sourceSans.variable} flex min-h-0 min-w-0 flex-1 flex-col`}
      style={{
        fontFamily: "var(--font-helpdesk-sans), 'Source Sans 3', var(--font-sans), sans-serif",
      }}
    >
      <PortalShell user={user}>
        <Kp2Shell>{children}</Kp2Shell>
      </PortalShell>
    </div>
  );
}
