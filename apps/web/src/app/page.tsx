import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { TicketList } from "@/components/ticket-list";
import { TicketListShell } from "@/components/ticket-list-shell";
import { TicketListSkeleton } from "@/components/ticket-list-skeleton";
import { getServerUser } from "@/lib/auth-server";
import { isStaff, TOKEN_COOKIE } from "@/lib/auth";
import { staffLandingPath, UI_MODE_COOKIE } from "@/lib/classic-ui-mode";
import {
  CHANGE_PASSWORD_PATH,
  userMustChangePassword,
} from "@/lib/must-change-password";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return (
      <div className="star-page px-6 py-10">
        <LoginForm />
      </div>
    );
  }

  const currentUser = await getServerUser();
  if (userMustChangePassword(currentUser)) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  const staff = isStaff(currentUser);
  const landing = staffLandingPath(currentUser, cookieStore.get(UI_MODE_COOKIE)?.value);

  if (staff && landing !== "/") {
    redirect(landing);
  }

  const list = (
    <Suspense fallback={<TicketListSkeleton />}>
      <TicketListShell>
        <TicketList />
      </TicketListShell>
    </Suspense>
  );

  if (staff) {
    return list;
  }

  return <main className="star-page">{list}</main>;
}
