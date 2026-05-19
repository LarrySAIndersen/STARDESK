"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { IntegrationStatusPill } from "@/components/integrations/integration-status-pill";
import {
  getDisplayStatus,
  INTEGRATION_META,
  slackSidebarLabel,
} from "@/lib/integrations-config";
import { useIntegrationsConfig } from "@/hooks/use-integrations-config";

export function IntegrationsOverviewGrid() {
  const config = useIntegrationsConfig();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {INTEGRATION_META.map((meta) => {
        const itemConfig = config[meta.id];
        const status = getDisplayStatus(meta.id, itemConfig);
        const pillLabel = meta.id === "slack" ? slackSidebarLabel(config.slack) : undefined;

        return (
          <Link
            key={meta.id}
            href={meta.href}
            className="wire-card group flex flex-col gap-2 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-star-navy text-sm font-bold">{meta.name}</h2>
              <IntegrationStatusPill status={status} label={pillLabel} />
            </div>
            <p className="text-muted-foreground flex-1 text-xs leading-relaxed">
              {meta.description}
            </p>
            <span className="text-star-navy flex items-center gap-1 text-[11px] font-semibold group-hover:underline">
              Åbn indstillinger
              <ChevronRight className="size-3.5 opacity-60" aria-hidden />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
