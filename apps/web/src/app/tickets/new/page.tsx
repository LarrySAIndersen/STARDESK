import { CreateTicketForm } from "@/components/create-ticket-form";
import { PageHero } from "@/components/page-hero";
import { apiGetServer } from "@/lib/api-server";
import type { Category } from "@/types/category";

export default async function NewTicketPage() {
  let categories: Category[] = [];
  try {
    categories = await apiGetServer<Category[]>("/api/v1/categories");
  } catch {
    categories = [];
  }

  return (
    <main className="star-page max-w-3xl">
      <PageHero title="Opret sag" lead="Udfyld formularen — sagen routes automatisk til det rigtige team." />
      <CreateTicketForm categories={categories} />
    </main>
  );
}
