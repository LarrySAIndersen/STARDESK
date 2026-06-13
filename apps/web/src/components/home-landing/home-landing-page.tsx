import { HomeLanding } from "@/components/home-landing/home-landing";

import { buildAppSitemapSections } from "@/lib/app-sitemap";

import { isStaff } from "@/lib/auth";

import { fetchHiddenNavIds } from "@/lib/sidebar-nav-visibility-server";

import type { User } from "@/types/user";



export async function HomeLandingPage({ user }: Readonly<{ user: User }>) {

  const hiddenNavIds = await fetchHiddenNavIds();

  const sections = buildAppSitemapSections(user, hiddenNavIds);

  return (

    <HomeLanding

      user={user}

      sections={sections}

      showWorkspaceLinks={isStaff(user)}

    />

  );

}

