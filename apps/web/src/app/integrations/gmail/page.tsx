import { GmailIntegrationSettings } from "@/components/integrations/gmail-integration-settings";

export default function GmailIntegrationPage() {
  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        Forbind Gmail med OAuth for at oprette sager fra indgående mail og svare med sagsnummer i samme tråd.
      </p>
      <GmailIntegrationSettings />
    </div>
  );
}
