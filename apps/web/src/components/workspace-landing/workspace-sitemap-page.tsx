"use client";

import { useMemo, useState } from "react";

import { WorkspaceLandingSideNav } from "@/components/workspace-landing/workspace-landing-side-nav";
import { WorkspaceLandingSitemap } from "@/components/workspace-landing/workspace-landing-sitemap";
import { parseWorkspaceSpace } from "@/lib/workspace-landing/layout-utils";
import { readWorkspaceLanding } from "@/lib/workspace-landing/storage";
import type { User } from "@/types/user";

export function WorkspaceSitemapPage({ user }: Readonly<{ user: User }>) {
  const [layout] = useState(() => readWorkspaceLanding(user.id));
  const space = useMemo(() => parseWorkspaceSpace("personal"), []);

  return (
    <div className="flex min-h-0 flex-1">
      <WorkspaceLandingSideNav
        space={space}
        view="sitemap"
        widgets={layout[space]}
        searchParams=""
      />
      <div className="wire-scroll-content min-h-0 flex-1 p-5">
        <WorkspaceLandingSitemap space={space} layout={layout} searchParams="" />
      </div>
    </div>
  );
}
