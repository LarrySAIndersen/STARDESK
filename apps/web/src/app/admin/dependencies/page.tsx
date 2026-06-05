import { redirect } from "next/navigation";

import { AdminDependenciesPanel } from "@/components/admin-dependencies-panel";
import { isAdmin } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export default async function AdminDependenciesPage() {
  const currentUser = await getServerUser();

  if (!isAdmin(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-4">
      <p className="text-muted-foreground max-w-3xl text-sm">
        Overvåg tredjepartsbiblioteker, egne monorepo-moduler og kendte CVE&apos;er med CVSS-score.
        Rapporten caches i op til én time — brug &quot;Kør kontrol nu&quot; for at opdatere.
      </p>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminDependenciesPanel />
        </div>
        
        <div className="space-y-4">
          <section aria-labelledby="sbom-analyzer-heading">
            <h2 id="sbom-analyzer-heading" className="wire-card-title mb-3">
              ReleaseRun SBOM Health Analyzer
            </h2>
            <div className="wire-card overflow-hidden p-0 border border-[var(--gray-border)]">
              <p className="p-4 text-xs text-muted-foreground">
                Analyser din <code className="bg-slate-100 px-1 py-0.5 rounded">sbom.json</code> direkte her. 
                Værktøjet kører 100% sikkert i din browser og sender ingen data væk fra din maskine.
              </p>
              <iframe 
                src="https://releaserun.com/tools/sbom-analyzer/?rr_embed=1" 
                className="w-full h-[580px] border-0" 
                loading="lazy" 
                title="ReleaseRun SBOM Health Analyzer"
              />
              <div className="p-4 bg-slate-50 border-t border-[var(--gray-border)] text-xs">
                <p className="font-semibold text-slate-700">Sådan gør du:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1 text-slate-600">
                  <li>Hent din seneste SBOM på <a href="/api/v1/platform/sbom" target="_blank" rel="noopener noreferrer" className="text-star-blue hover:underline">/api/v1/platform/sbom</a></li>
                  <li>Træk filen ind i scanneren ovenfor</li>
                </ol>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
