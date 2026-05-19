import { SlackIntegrationSettingsForm } from "@/components/integrations/integration-settings-form";

export default function SlackIntegrationPage() {
  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        Slack er aktiv i prototypen (mock). Push fra sager bruger mock-kanaler.
      </p>
      <SlackIntegrationSettingsForm />
    </div>
  );
}
