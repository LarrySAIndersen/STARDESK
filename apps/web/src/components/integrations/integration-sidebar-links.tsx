"use client";

import Link from "next/link";
import { Mail, MessageSquare, Ticket, Wrench } from "lucide-react";

import { NavVisibilityEye } from "@/components/agent/nav-visibility-eye";
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
  gmail: Mail,
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
  hiddenNavIds = [],
  isTopAdmin = false,
  onToggleHidden,
  showSectionHeader = true,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  hiddenNavIds?: string[];
  isTopAdmin?: boolean;
  onToggleHidden?: (navId: string, hide: boolean) => void;
  /** When wrapped in CollapsibleNavSection, omit duplicate section label. */
  showSectionHeader?: boolean;
}) {
  const config = useIntegrationsConfig();
  const hidden = new Set(hiddenNavIds);
  const visibleMeta = INTEGRATION_META.filter((meta) => {
    const navId = `integration-${meta.id}`;
    return isTopAdmin || !hidden.has(navId);
  });

  if (visibleMeta.length === 0) {
    return null;
  }

  return (
    <>
      {showSectionHeader && !collapsed ? (
        <p className="wire-nav-section">Integration</p>
      ) : null}
      {visibleMeta.map((meta) => {
        const Icon = ICONS[meta.id];
        const navId = `integration-${meta.id}`;
        const itemConfig = config[meta.id];
        const status = getDisplayStatus(meta.id, itemConfig);
        const pillLabel = meta.id === "slack" ? slackSidebarLabel(config.slack) : undefined;
        const active = isIntegrationActive(pathname, meta.href);
        const isHiddenForOthers = hidden.has(navId);

        return (
          <Link
            key={meta.id}
            href={meta.href}
            onClick={onNavigate}
            className={cn(
              "wire-nav-item wire-nav-item--integration",
              active && "wire-nav-item--active",
              collapsed && "wire-nav-item--compact",
              isTopAdmin && isHiddenForOthers && "opacity-80",
            )}
          >
            <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{meta.name}</span>
            {isTopAdmin && onToggleHidden ? (
              <NavVisibilityEye
                hidden={isHiddenForOthers}
                collapsed={collapsed}
                onToggle={() => onToggleHidden(navId, !isHiddenForOthers)}
              />
            ) : (
              <IntegrationStatusPill
                status={status}
                label={pillLabel}
                compact={collapsed}
                className="ml-auto shrink-0"
              />
            )}
          </Link>
        );
      })}
    </>
  );
}
