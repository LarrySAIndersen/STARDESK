"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Briefcase,
  Lightbulb,
  LineChart,
  Pencil,
} from "lucide-react";

import { HomeLandingCollapsibleSection } from "@/components/home-landing/home-landing-collapsible-section";
import { HomeLandingMentions } from "@/components/home-landing/home-landing-mentions";
import { HomeLandingStarbotCard } from "@/components/home-landing/home-landing-starbot-card";
import { HomeLandingWatchedTickets } from "@/components/home-landing/home-landing-watched-tickets";
import { HomeLandingWorkspaceLinks } from "@/components/home-landing/home-landing-workspace-links";
import { TicketWatchUpdatesBanner } from "@/components/tickets/ticket-watch-updates-banner";
import { StarLogo } from "@/components/star-logo";
import {
  isExternalNavHref,
  navIconForItemId,
  type AppSitemapSection,
} from "@/lib/app-sitemap";
import { pickHomeLandingGreeting } from "@/lib/home-landing/greeting-picker";
import { recordHomeVisit } from "@/lib/home-landing/home-visit-tracker";
import type { User } from "@/types/user";

type HomeLandingProps = Readonly<{
  user: User;
  sections: AppSitemapSection[];
  showWorkspaceLinks?: boolean;
}>;

const QUICK_LINK_IDS = [
  "tickets",
  "projekter",
  "service-desk",
  "portal",
  "arbejdsrum",
  "tickets-new",
  "knowledge",
] as const;

function SitemapLink({
  href,
  label,
  itemId,
}: Readonly<{
  href: string;
  label: string;
  itemId: string;
}>) {
  const Icon = navIconForItemId(itemId);
  const external = isExternalNavHref(href);
  const className =
    "home-landing-sitemap__link group flex items-center gap-2 rounded-full border border-[#e8e6e1] bg-white px-3 py-1.5 text-sm text-[#3d3d3a] transition-colors hover:border-[#d4d2cc] hover:bg-[#faf9f7]";

  const content = (
    <>
      <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden />
      <span className="truncate">{label}</span>
      <ArrowUpRight
        className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
        aria-hidden
      />
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export function HomeLanding({ user, sections, showWorkspaceLinks = false }: HomeLandingProps) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    const visitCount = recordHomeVisit(user.id);
    setGreeting(
      pickHomeLandingGreeting({
        displayName: user.display_name,
        visitCountToday: visitCount,
      }),
    );
  }, [user.id, user.display_name]);

  const quickLinks = useMemo(() => {
    const allItems = sections.flatMap((section) => section.items);
    const picked = QUICK_LINK_IDS
      .map((id) => allItems.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
    if (picked.length >= 4) {
      return picked.slice(0, 4);
    }
    const seen = new Set(picked.map((item) => item.id));
    for (const item of allItems) {
      if (seen.has(item.id)) continue;
      picked.push(item);
      if (picked.length >= 4) break;
    }
    return picked;
  }, [sections]);

  const quickIcons = [Pencil, LineChart, Briefcase, Lightbulb];

  const totalLinks = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="home-landing">
      <div className="home-landing__inner">
        <header className="home-landing__header">
          <div className="home-landing__greeting-row">
            <StarLogo className="home-landing__mark" markSize={36} priority />
            <h1 className="home-landing__greeting" suppressHydrationWarning>
              {greeting ?? `Hej, ${user.display_name}`}
            </h1>
          </div>
          <p className="home-landing__role">
            {user.role_label} · {totalLinks} sider tilgængelige for dig
          </p>
        </header>

        <HomeLandingStarbotCard user={user} />

        {showWorkspaceLinks ? <TicketWatchUpdatesBanner /> : null}

        {showWorkspaceLinks ? <HomeLandingWatchedTickets userId={user.id} /> : null}

        {showWorkspaceLinks ? <HomeLandingMentions userId={user.id} /> : null}

        {showWorkspaceLinks ? (
          <HomeLandingCollapsibleSection
            userId={user.id}
            sectionId="workspace"
            title="Arbejdsrum"
            subtitle="Dashboard, noter, kanban og sager"
            defaultOpen={true}
          >
            <HomeLandingWorkspaceLinks userId={user.id} displayName={user.display_name} />
          </HomeLandingCollapsibleSection>
        ) : null}

        {quickLinks.length > 0 ? (
          <HomeLandingCollapsibleSection
            userId={user.id}
            sectionId="quick-links"
            title="Hurtige genveje"
            defaultOpen={false}
          >
            <nav className="home-landing__quick" aria-label="Hurtige genveje">
            {quickLinks.map((item, index) => {
              const QuickIcon = quickIcons[index % quickIcons.length];
              const external = isExternalNavHref(item.href);
              const className = "home-landing__quick-btn";
              const inner = (
                <>
                  <QuickIcon className="size-4 shrink-0 opacity-70" aria-hidden />
                  {item.label}
                </>
              );
              if (external) {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={item.id} href={item.href} className={className}>
                  {inner}
                </Link>
              );
            })}
            </nav>
          </HomeLandingCollapsibleSection>
        ) : null}

        <HomeLandingCollapsibleSection
          userId={user.id}
          sectionId="sitemap"
          title="Hovednavigation"
          subtitle={`${totalLinks} sider tilgængelige for dig`}
          defaultOpen={false}
        >
          <div className="home-landing-sitemap" aria-label="Sitemap">
          {sections.map((section) => (
            <section key={section.id} className="home-landing-sitemap__section">
              <h2 className="home-landing-sitemap__section-title">{section.label}</h2>
              <ul className="home-landing-sitemap__list">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <SitemapLink href={item.href} label={item.label} itemId={item.id} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          </div>
        </HomeLandingCollapsibleSection>
      </div>
    </div>
  );
}
