import { redirect } from "next/navigation";

import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export default async function DevelopersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getServerUser();
  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return <>{children}</>;
}
