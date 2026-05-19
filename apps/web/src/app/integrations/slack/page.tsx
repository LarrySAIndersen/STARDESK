import { SlackIntegrationSettings } from "@/components/integrations/slack-integration-settings";

export default function SlackIntegrationPage() {
  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        Forbind Slack med OAuth for at sende rigtige beskeder fra STARdesk.
      </p>
      <SlackIntegrationSettings />
    </div>
  );
}
