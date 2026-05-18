import { CreateTicketForm } from "@/components/create-ticket-form";
import { apiGetServer } from "@/lib/api-server";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";
import type { Category } from "@/types/category";

export default async function NewTicketPage() {
  let categories: Category[] = [];
  const currentUser = await getServerUser();
  const staffOnly = isStaff(currentUser);

  try {
    categories = await apiGetServer<Category[]>("/api/v1/categories", { revalidate: 300 });
  } catch {
    categories = [];
  }

  return (
    <div className="wire-scroll-content mx-auto w-full max-w-xl flex-1">
      <CreateTicketForm categories={categories} staffOnly={staffOnly} />
    </div>
  );
}
