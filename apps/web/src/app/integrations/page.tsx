import { IntegrationsOverviewGrid } from "@/components/integrations/integrations-overview-grid";

export default function IntegrationsPage() {
  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        Konfigurer Gmail, Slack, Jira og TOPdesk uafhængigt af hinanden. Integrationer kan
        gemmes som kladde uden at være aktive.
      </p>
      <IntegrationsOverviewGrid />
    </div>
  );
}
