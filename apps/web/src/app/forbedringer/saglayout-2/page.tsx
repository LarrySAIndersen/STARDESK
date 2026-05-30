import { redirect } from "next/navigation";

import { Saglayout2Prototype } from "@/components/forbedringer/saglayout-2-prototype";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";

export default async function Saglayout2Page() {
  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return <Saglayout2Prototype />;
}
