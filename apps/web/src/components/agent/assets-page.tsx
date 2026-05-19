"use client";

import { Suspense } from "react";

import { AssetTree } from "@/components/agent/asset-tree";

export function AssetsPage() {
  return (
    <div className="wire-scroll-content flex min-h-0 flex-1 flex-col p-5">
      <p className="text-muted-foreground mb-4 max-w-2xl text-sm">
        Vælg et system eller undersystem for at filtrere sager. CMDB-data er midlertidigt
        statisk, indtil aktiver er gemt i databasen.
      </p>
      <div className="wire-assets-card flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="wire-asset-panel-header">Aktiver</div>}>
          <AssetTree />
        </Suspense>
      </div>
    </div>
  );
}
