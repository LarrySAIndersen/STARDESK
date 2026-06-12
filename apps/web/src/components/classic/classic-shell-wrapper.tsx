import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ClassicShell } from "@/components/classic/classic-shell";
import { ClientSessionHydrator } from "@/components/client-session-hydrator";
import { isStaff, TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export async function ClassicShellWrapper({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    redirect("/");
  }

  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/portal");
  }

  return (
    <>
      <ClientSessionHydrator />
      <ClassicShell title={title} user={currentUser}>
        {children}
      </ClassicShell>
    </>
  );
}
