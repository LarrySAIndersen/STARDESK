import { CreateTicketForm } from "@/components/create-ticket-form";
import { apiGet } from "@/lib/api";
import type { Category } from "@/types/category";

export default async function NewTicketPage() {
  let categories: Category[] = [];
  try {
    categories = await apiGet<Category[]>("/api/v1/categories");
  } catch {
    categories = [];
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <CreateTicketForm categories={categories} />
    </main>
  );
}
