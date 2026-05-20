"use client";

import Link from "next/link";
import { MessageSquare, Ticket, Wrench } from "lucide-react";

import { IntegrationStatusPill } from "@/components/integrations/integration-status-pill";
import {
  getDisplayStatus,
  INTEGRATION_META,
  slackSidebarLabel,
} from "@/lib/integrations-config";
import { useIntegrationsConfig } from "@/hooks/use-integrations-config";
import { cn } from "@/lib/utils";

const ICONS = {
  slack: MessageSquare,
  jira: Ticket,
  topdesk: Wrench,
} as const;

function isIntegrationActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function IntegrationSidebarLinks({
  pathname,
  collapsed = false,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const config = useIntegrationsConfig();

  return (
    <>
      {collapsed ? null : <p className="wire-nav-section">Integration</p>}
      {INTEGRATION_META.map((meta) => {
        const Icon = ICONS[meta.id];
        const itemConfig = config[meta.id];
        const status = getDisplayStatus(meta.id, itemConfig);
        const pillLabel = meta.id === "slack" ? slackSidebarLabel(config.slack) : undefined;
        const active = isIntegrationActive(pathname, meta.href);

        return (
          <Link
            key={meta.id}
            href={meta.href}
            onClick={onNavigate}
            className={cn(
              "wire-nav-item wire-nav-item--integration",
              active && "wire-nav-item--active",
              collapsed && "wire-nav-item--compact",
            )}
          >
            <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{meta.name}</span>
            <IntegrationStatusPill
              status={status}
              label={pillLabel}
              compact={collapsed}
              className="ml-auto shrink-0"
            />
          </Link>
        );
      })}
    </>
  );
}
