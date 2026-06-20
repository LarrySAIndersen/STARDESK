import { redirect } from "next/navigation";

import { PersonalSettingsPanel } from "@/components/personal-settings-panel";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function IndstillingerPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 p-6">
      <h1 className="wire-sec-title mb-6 text-lg">Personlige indstillinger</h1>
      <PersonalSettingsPanel user={user} />
    </div>
  );
}
