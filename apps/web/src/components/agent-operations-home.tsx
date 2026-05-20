"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AgentOperationsDashboard } from "@/components/agent-operations-dashboard";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { apiGet } from "@/lib/api";
import { canManageUsers } from "@/lib/auth";
import {
  DASHBOARD_SCOPE_DESCRIPTIONS,
  DASHBOARD_SCOPE_LABELS,
  type DashboardScope,
} from "@/lib/dashboard-ticket-links";
import { cn } from "@/lib/utils";
import type { OperationsDashboard } from "@/types/dashboard";
import type { User } from "@/types/user";

const SCOPE_TABS: DashboardScope[] = ["personal", "mine", "group", "created"];

export function AgentOperationsHome({
  initialDashboard,
  initialScope,
  user,
}: {
  initialDashboard: OperationsDashboard;
  initialScope: DashboardScope;
  user: User | null;
}) {
  const [scope, setScope] = useState<DashboardScope>(initialScope);
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountScopeRef = useRef(initialScope);

  const showAllScope = canManageUsers(user);

  const fetchDashboard = useCallback(async (nextScope: DashboardScope) => {
    return apiGet<OperationsDashboard>(
      `/api/v1/reports/dashboard?scope=${encodeURIComponent(nextScope)}`,
    );
  }, []);

  const loadScope = useCallback(
    async (nextScope: DashboardScope) => {
      setScope(nextScope);
      setLoading(true);
      setError(null);
      try {
        setDashboard(await fetchDashboard(nextScope));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke hente dashboard");
      } finally {
        setLoading(false);
      }
    },
    [fetchDashboard],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDashboard(mountScopeRef.current);
        if (!cancelled) {
          setDashboard(data);
        }
      } catch {
        // keep SSR payload on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchDashboard]);

  const tabs: DashboardScope[] = showAllScope ? [...SCOPE_TABS, "all"] : SCOPE_TABS;

  return (
    <div className="border-b border-[var(--gray-border)] px-5 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-star-navy text-xl font-bold tracking-tight">Driftsdashboard</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {DASHBOARD_SCOPE_DESCRIPTIONS[scope]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap gap-1 rounded-lg border border-[var(--gray-border)] bg-white p-1"
            role="tablist"
            aria-label="Dashboard omfang"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={scope === tab}
                disabled={loading}
                onClick={() => {
                  if (tab !== scope) void loadScope(tab);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  scope === tab
                    ? "bg-star-navy text-white"
                    : "text-star-navy hover:bg-secondary",
                )}
              >
                {DASHBOARD_SCOPE_LABELS[tab]}
              </button>
            ))}
          </div>
          <ClearFiltersButton
            visible={scope !== initialScope}
            onClick={() => {
              if (scope !== initialScope) void loadScope(initialScope);
            }}
          />
        </div>
      </div>
      {error ? <p className="text-star-red mb-3 text-sm">{error}</p> : null}
      <div className={loading ? "pointer-events-none opacity-60" : undefined}>
        <AgentOperationsDashboard dashboard={dashboard} scope={scope} />
      </div>
    </div>
  );
}
