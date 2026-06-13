import { redirect } from "next/navigation";

import { TeamWikiApp } from "@/components/team-wiki/team-wiki-app";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeamWikiPage() {
  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <TeamWikiApp />
    </div>
  );
}
