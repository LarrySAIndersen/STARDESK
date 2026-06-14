import Link from "next/link";

import { TopdeskIntegrationSettingsForm } from "@/components/integrations/integration-settings-form";

export default function TopdeskIntegrationPage() {
  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        TOPdesk kan kobles via den stabile Integration API (maskin-nøgle og sagstyper).
        Gem UI-indstillinger som kladde — fuld TOPdesk OAuth/REST-sync kommer senere.{" "}
        <Link href="/developers/api" className="text-star-navy font-semibold hover:underline">
          Se API-dokumentation
        </Link>
        .
      </p>
      <TopdeskIntegrationSettingsForm />
    </div>
  );
}
