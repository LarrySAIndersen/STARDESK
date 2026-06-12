import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/** Min side er flyttet til forsiden under Eget space. */
export default async function MinSideRedirectPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  redirect("/?space=personal");
}
