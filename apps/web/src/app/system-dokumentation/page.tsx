import { redirect } from "next/navigation";

import { SystemDocumentationPage } from "@/components/system-documentation/system-documentation-page";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function SystemDocumentationRoute() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  return <SystemDocumentationPage />;
}
