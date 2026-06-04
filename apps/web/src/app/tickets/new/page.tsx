import { CreateTicketForm } from "@/components/create-ticket-form";
import { apiGetServer } from "@/lib/api-server";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fromSfChat = params.from_sf_chat === "1";
  let categories: Category[] = [];
  let teams: Team[] = [];
  const currentUser = await getServerUser();
  const staffOnly = isStaff(currentUser);

  try {
    categories = await apiGetServer<Category[]>("/api/v1/categories", { revalidate: 300 });
  } catch {
    categories = [];
  }

  if (staffOnly) {
    try {
      teams = await apiGetServer<Team[]>("/api/v1/teams");
    } catch {
      teams = [];
    }
  }

  return (
    <div className="wire-scroll-content mx-auto w-full max-w-3xl flex-1">
      <CreateTicketForm
        categories={categories}
        teams={teams}
        staffOnly={staffOnly}
        prefillFromSfChat={fromSfChat}
      />
    </div>
  );
}
