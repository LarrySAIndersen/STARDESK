import Link from "next/link";
import { redirect } from "next/navigation";

import { SwaggerUiPanel } from "@/app/developers/api/swagger-ui";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export default async function DevelopersApiPage() {
  const currentUser = await getServerUser();
  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-6">
      <div className="max-w-3xl space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Udviklere
        </p>
        <h1 className="text-star-navy text-xl font-bold">API &amp; integration</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          OpenAPI-specifikationen beskriver både medarbejder-API&apos;et (JWT) og den stabile
          integrationskontrakt under <code className="text-xs">/api/v1/integration/</code>.
          Brug <strong>Integration API</strong>-tagget til TOPdesk, Jira og andre systemer.
        </p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>
            Maskin-adgang: header <code className="text-xs">X-Integration-Key</code> og valgfrit{" "}
            <code className="text-xs">X-Integration-System</code> (fx <em>topdesk</em>).
          </li>
          <li>
            Sagstyper: <code className="text-xs">GET /api/v1/integration/case-types</code>
          </li>
          <li>
            Ekstern reference: <code className="text-xs">ext:&#123;system&#125;:&#123;id&#125;</code>
          </li>
        </ul>
        <p className="text-muted-foreground text-sm">
          Se også{" "}
          <Link href="/integrations" className="text-star-navy font-semibold hover:underline">
            Integrationer
          </Link>{" "}
          for OAuth-forbindelser (Gmail, Slack).
        </p>
      </div>
      <SwaggerUiPanel />
    </div>
  );
}
