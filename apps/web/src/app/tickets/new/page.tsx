import { cookies } from "next/headers";

import { CreateTicketForm } from "@/components/create-ticket-form";
import { PageHero } from "@/components/page-hero";
import { apiGetServer } from "@/lib/api-server";
import { isStaff, USER_COOKIE } from "@/lib/auth";
import type { Category } from "@/types/category";
import type { User } from "@/types/user";

export default async function NewTicketPage() {
  let categories: Category[] = [];
  let staffOnly = false;

  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  if (userCookie) {
    try {
      const currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
      staffOnly = isStaff(currentUser);
    } catch {
      staffOnly = false;
    }
  }

  try {
    categories = await apiGetServer<Category[]>("/api/v1/categories", { revalidate: 300 });
  } catch {
    categories = [];
  }

  return (
    <main className="star-page max-w-3xl">
      <PageHero title="Opret sag" lead="Udfyld formularen — sagen routes automatisk til det rigtige team." />
      <CreateTicketForm categories={categories} staffOnly={staffOnly} />
    </main>
  );
}
