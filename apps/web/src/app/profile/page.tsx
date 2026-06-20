import Link from "next/link";
import { redirect } from "next/navigation";

import { UserAvatar } from "@/components/agent/user-avatar";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  if (isStaff(user)) {
    redirect(`/users/${user.id}`);
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 p-6">
      <h1 className="wire-sec-title mb-6 text-lg">Min profil</h1>
      <div className="wire-card mb-0 max-w-lg">
        <div className="mb-4 flex items-center gap-4">
          <UserAvatar user={user} size="lg" />
          <div>
            <p className="text-star-navy text-lg font-semibold">{user.display_name}</p>
            <p className="text-muted-foreground text-sm">{user.role_label}</p>
          </div>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs font-bold uppercase">E-mail</dt>
            <dd>{user.email}</dd>
          </div>
          {user.organization_name ? (
            <div>
              <dt className="text-muted-foreground text-xs font-bold uppercase">Organisation</dt>
              <dd>{user.organization_name}</dd>
            </div>
          ) : null}
        </dl>
        <p className="text-muted-foreground mt-4 text-xs">
          Brug{" "}
          <Link href="/skift-adgangskode" className="text-star-blue underline">
            skift adgangskode
          </Link>{" "}
          eller gå til{" "}
          <Link href="/indstillinger" className="text-star-blue underline">
            personlige indstillinger
          </Link>{" "}
          for at skifte profilbillede og udseende.
        </p>
      </div>
    </div>
  );
}
