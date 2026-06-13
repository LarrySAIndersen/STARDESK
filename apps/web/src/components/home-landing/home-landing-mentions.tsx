"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, AtSign, MessageCircle, UserPlus } from "lucide-react";

import { HomeLandingCollapsibleSection } from "@/components/home-landing/home-landing-collapsible-section";
import { apiGet } from "@/lib/api";import { MENTIONS_OVERVIEW_CHANGED_EVENT, type PersonalMentionsOverview } from "@/types/ticket-internal-chat";

function kindLabel(kind: PersonalMentionsOverview["items"][number]["kind"], invitedByMe: boolean): string {
  if (kind === "mention") return "Nævnt i kommentar";
  if (invitedByMe) return "Du indkaldte";
  return "Deltager i chat";
}

function kindIcon(kind: PersonalMentionsOverview["items"][number]["kind"]) {
  if (kind === "mention") return AtSign;
  return MessageCircle;
}

export function HomeLandingMentions({ userId }: Readonly<{ userId: string }>) {
  const [items, setItems] = useState<PersonalMentionsOverview["items"]>([]);

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<PersonalMentionsOverview>("/api/v1/personal/mentions-overview");
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    fireAndForget(reload());
  }, [reload]);

  useEffect(() => {
    const onChanged = () => fireAndForget(reload());
    window.addEventListener(MENTIONS_OVERVIEW_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(MENTIONS_OVERVIEW_CHANGED_EVENT, onChanged);
  }, [reload]);

  if (items.length === 0) {
    return null;
  }

  const invited = items.filter((i) => i.invited_by_me && i.kind !== "mention");
  const participated = items.filter((i) => !i.invited_by_me);

  return (
    <HomeLandingCollapsibleSection
      userId={userId}
      sectionId="mentions"
      title="Mine @mentions"
      defaultOpen={true}
    >
      <div className="home-landing__watched-inner">
        <div className="home-landing__watched-header">
          <Link href="/tickets" className="home-landing__watched-link">
            Alle sager
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>

      {participated.length > 0 ? (
        <>
          <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
            Deltaget i
          </p>
          <ul className="home-landing__watched-list mb-3">
            {participated.slice(0, 6).map((item) => {
              const Icon = kindIcon(item.kind);
              return (
                <li key={`${item.kind}-${item.ticket_id}`}>
                  <Link
                    href={`/tickets/${item.ticket_id}#ticket-internal-chat`}
                    className="home-landing__watched-item group"
                  >
                    <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                    <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                      {item.ticket_number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {item.ticket_title}
                    </span>
                    <span className="text-muted-foreground hidden max-w-[8rem] truncate text-xs sm:inline">
                      {kindLabel(item.kind, item.invited_by_me)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {invited.length > 0 ? (
        <>
          <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
            Du har indkaldt til
          </p>
          <ul className="home-landing__watched-list">
            {invited.slice(0, 6).map((item) => (
              <li key={`inv-${item.ticket_id}`}>
                <Link
                  href={`/tickets/${item.ticket_id}#ticket-internal-chat`}
                  className="home-landing__watched-item group"
                >
                  <UserPlus className="size-3.5 shrink-0 text-[var(--star-blue)]" aria-hidden />
                  <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                    {item.ticket_number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item.ticket_title}
                  </span>
                  <span className="text-muted-foreground hidden max-w-[10rem] truncate text-xs sm:inline">
                    {item.subtitle}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      </div>
    </HomeLandingCollapsibleSection>
  );
}
