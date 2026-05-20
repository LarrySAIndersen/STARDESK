import { redirect } from "next/navigation";

import { AssetsPage } from "@/components/agent/assets-page";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export default async function AktiverPage() {
  const currentUser = await getServerUser();
  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return <AssetsPage serverUser={currentUser} />;
}
