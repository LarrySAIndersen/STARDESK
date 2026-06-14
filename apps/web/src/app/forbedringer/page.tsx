import { redirect } from "next/navigation";

import { ForbedringerPanel } from "@/components/forbedringer/forbedringer-panel";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";

export default async function ForbedringerPage() {
  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return <ForbedringerPanel user={currentUser} />;
}
