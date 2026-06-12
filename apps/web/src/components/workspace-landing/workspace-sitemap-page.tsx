"use client";

import { useEffect, useMemo, useState } from "react";

import { WorkspaceLandingSideNav } from "@/components/workspace-landing/workspace-landing-side-nav";
import { WorkspaceLandingSitemap } from "@/components/workspace-landing/workspace-landing-sitemap";
import { fetchWorkspaceLandingRecord, type WorkspaceLandingRecord } from "@/lib/workspace-landing/api";
import { parseWorkspaceSpace } from "@/lib/workspace-landing/layout-utils";
import { readWorkspaceLanding, WORKSPACE_LANDING_CHANGED_EVENT } from "@/lib/workspace-landing/storage";
import type { WorkspaceLandingConfig } from "@/lib/workspace-landing/types";
import type { User } from "@/types/user";

export function WorkspaceSitemapPage({ user }: Readonly<{ user: User }>) {
  const [layout, setLayout] = useState<WorkspaceLandingConfig>(() => readWorkspaceLanding(user.id));
  const [landingRecord, setLandingRecord] = useState<WorkspaceLandingRecord | null>(null);
  const [landingLoading, setLandingLoading] = useState(true);
  const space = useMemo(() => parseWorkspaceSpace("personal"), []);

  useEffect(() => {
    let cancelled = false;

    async function loadFromApi() {
      setLandingLoading(true);
      const record = await fetchWorkspaceLandingRecord();
      if (cancelled) return;
      if (record) {
        setLandingRecord(record);
        setLayout(record.layout);
      }
      setLandingLoading(false);
    }

    void loadFromApi();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    function handleLayoutChanged(event: Event) {
      const detail = (event as CustomEvent<{ userId: string }>).detail;
      if (detail?.userId !== user.id) return;
      setLayout(readWorkspaceLanding(user.id));
    }

    window.addEventListener(WORKSPACE_LANDING_CHANGED_EVENT, handleLayoutChanged);
    return () => window.removeEventListener(WORKSPACE_LANDING_CHANGED_EVENT, handleLayoutChanged);
  }, [user.id]);

  return (
    <div className="flex min-h-0 flex-1">
      <WorkspaceLandingSideNav
        space={space}
        view="sitemap"
        widgets={layout[space]}
        searchParams=""
      />
      <div className="wire-scroll-content min-h-0 flex-1 p-5">
        <WorkspaceLandingSitemap
          userId={user.id}
          space={space}
          layout={layout}
          searchParams=""
          landingRecord={landingRecord}
          landingLoading={landingLoading}
        />
      </div>
    </div>
  );
}
