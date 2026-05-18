import { PageHero } from "@/components/page-hero";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";

export async function TicketListShell({ children }: { children: React.ReactNode }) {
  const currentUser = await getServerUser();

  if (isStaff(currentUser)) {
    return <>{children}</>;
  }

  return (
    <>
      <PageHero
        title="Sagsstyring"
        lead="Se dine sager og opret nye henvendelser til STAR Service Desk."
      />
      {children}
    </>
  );
}
