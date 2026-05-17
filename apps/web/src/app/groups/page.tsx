import { PageHero } from "@/components/page-hero";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { isStaff, USER_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Team } from "@/types/team";
import type { User } from "@/types/user";

export default async function GroupsPage() {
  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  let currentUser: User | null = null;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  if (!isStaff(currentUser)) {
    redirect("/login");
  }

  let teams: Team[] = [];
  let error: string | null = null;
  try {
    teams = await apiGetServer<Team[]>("/api/v1/teams");
  } catch (err) {
    if (err instanceof ApiError) {
      error = err.message;
    } else {
      error = "Kunne ikke hente grupper";
    }
  }

  return (
    <main className="star-page">
      <PageHero
        title="Grupper"
        lead="Grupper modtager sager og har tilknyttede sagsbehandlere — samme struktur som på star.dk."
      />

      {error ? (
        <p className="text-destructive mt-6 text-sm">{error}</p>
      ) : teams.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">Ingen grupper fundet.</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          {teams.map((team) => (
            <li key={team.id}>
              <Card className="star-section-card overflow-hidden">
                <CardHeader className="bg-star-blue-light border-b">
                  <CardTitle className="text-star-navy">{team.name}</CardTitle>
                  {team.description ? (
                    <CardDescription>{team.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                    Medlemmer ({team.members.length})
                  </p>
                  {team.members.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Ingen medlemmer</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {team.members.map((member) => (
                        <li key={member.user_id} className="flex justify-between gap-2">
                          <span>{member.display_name}</span>
                          <span className="text-muted-foreground text-xs">
                            {member.role_label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
