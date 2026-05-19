import { TopdeskIntegrationSettingsForm } from "@/components/integrations/integration-settings-form";

export default function TopdeskIntegrationPage() {
  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        TOPdesk-integrationen er endnu inaktiv. Gem indstillinger som kladde — aktivering
        kommer senere.
      </p>
      <TopdeskIntegrationSettingsForm />
    </div>
  );
}
