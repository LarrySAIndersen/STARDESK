import { redirect } from "next/navigation";

import { ForbedringerPanel } from "@/components/forbedringer/forbedringer-panel";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";

export default async function ForbedringerPage() {
  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-6">
      <ForbedringerPanel />
    </div>
  );
}
