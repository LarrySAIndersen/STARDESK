import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";

import { PortalShell } from "@/components/portal/portal-shell";
import { TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-helpdesk-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-helpdesk-serif",
});

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  if (!cookieStore.get(TOKEN_COOKIE)?.value) {
    return {
      title: "STAR Help Desk — Velkommen",
      description: "STAR Help Desk login og selvbetjening",
    };
  }
  return {
    title: "STARdesk — Selvbetjening",
    description: "STAR ITSM selvbetjeningsportal",
  };
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return (
      <div
        className={`${sourceSans.variable} ${sourceSerif.variable} flex min-h-dvh flex-1 flex-col`}
        style={{
          fontFamily: "var(--font-helpdesk-sans), 'Source Sans 3', sans-serif",
        }}
      >
        {children}
      </div>
    );
  }

  const user = await getServerUser();
  return <PortalShell user={user}>{children}</PortalShell>;
}
