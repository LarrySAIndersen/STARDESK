import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/change-password-form";
import { StarLogo } from "@/components/star-logo";
import { isStaff, TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import { staffLandingPath, UI_MODE_COOKIE } from "@/lib/classic-ui-mode";
import { userMustChangePassword } from "@/lib/must-change-password";

export const dynamic = "force-dynamic";

export default async function SkiftAdgangskodePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const currentUser = token ? await getServerUser() : null;
  const uiModeCookie = cookieStore.get(UI_MODE_COOKIE)?.value ?? null;

  if (currentUser && !userMustChangePassword(currentUser)) {
    redirect(staffLandingPath(currentUser, uiModeCookie));
  }

  const dashboardHref = staffLandingPath(currentUser, uiModeCookie);
  const showSkipToDashboard = Boolean(
    currentUser && isStaff(currentUser) && userMustChangePassword(currentUser),
  );

  return (
    <main className="star-page px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <StarLogo className="size-10" />
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">STARdesk</h1>
        <p className="text-muted-foreground text-sm">Skift din adgangskode</p>
      </div>
      <ChangePasswordForm
        showSkipToDashboard={showSkipToDashboard}
        dashboardHref={dashboardHref}
      />
    </main>
  );
}
