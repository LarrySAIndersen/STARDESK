import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";
import { buildWorkspaceHref } from "@/lib/workspace-landing/layout-utils";

export const dynamic = "force-dynamic";

/** Min side lives under Arbejdsrum → Eget space (staff) or home (portal users). */
export default async function MinSideRedirectPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (isStaff(user)) {
    redirect(buildWorkspaceHref({ space: "personal", view: "grid" }));
  }
  redirect("/");
}
