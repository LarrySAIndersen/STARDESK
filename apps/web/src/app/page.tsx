import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { HomeLandingPage } from "@/components/home-landing/home-landing-page";
import { TicketListShell } from "@/components/ticket-list-shell";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";
import {
  classicHomePath,
  parseUiMode,
  UI_MODE_COOKIE,
} from "@/lib/classic-ui-mode";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const currentUser = await getServerUser();

  if (!currentUser) {
    return (
      <div className="star-page px-6 py-10">
        <LoginForm />
      </div>
    );
  }

  const staff = isStaff(currentUser);

  if (staff && parseUiMode(cookieStore.get(UI_MODE_COOKIE)?.value) === "classic") {
    redirect(classicHomePath());
  }

  if (staff) {
    return (
      <TicketListShell>
        <HomeLandingPage user={currentUser} />
      </TicketListShell>
    );
  }

  return (
    <main className="star-page">
      <HomeLandingPage user={currentUser} />
    </main>
  );
}
