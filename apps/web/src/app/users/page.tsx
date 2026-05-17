import { AdminUsersPanel } from "@/components/admin-users-panel";
import { PageHero } from "@/components/page-hero";
import { isAdmin, USER_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/types/user";

export default async function UsersAdminPage() {
  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  let currentUser: User | null = null;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  if (!isAdmin(currentUser)) {
    redirect("/");
  }

  return (
    <main className="star-page">
      <PageHero
        title="Brugere"
        lead="Administrer konti, rettighedsgrupper, gruppemedlemskaber og adgangskoder."
      />
      <AdminUsersPanel currentUserRole={currentUser!.role} />
    </main>
  );
}
