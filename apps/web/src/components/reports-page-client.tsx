"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const ReportsDashboard = dynamic(
  () => import("@/components/reports-dashboard").then((mod) => mod.ReportsDashboard),
  {
    loading: () => (
      <p className="text-muted-foreground text-sm animate-pulse" aria-live="polite">
        Henter standardrapporter…
      </p>
    ),
  },
);

const PredefinedReports = dynamic(
  () => import("@/components/predefined-reports").then((mod) => mod.PredefinedReports),
  {
    loading: () => (
      <p className="text-muted-foreground text-sm animate-pulse" aria-live="polite">
        Henter brancherapporter…
      </p>
    ),
  },
);

const CustomReports = dynamic(
  () => import("@/components/custom-reports").then((mod) => mod.CustomReports),
  {
    loading: () => (
      <p className="text-muted-foreground text-sm animate-pulse" aria-live="polite">
        Henter rapportbygger…
      </p>
    ),
  },
);

export function ReportsPageClient() {
  const [activeTab, setActiveTab] = useState<"standard" | "predefined" | "custom">("standard");

  return (
    <div className="space-y-6">
      {/* Tabs navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Rapport kategorier">
          <button
            type="button"
            onClick={() => setActiveTab("standard")}
            className={`pb-4 text-sm font-semibold border-b-2 px-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue ${
              activeTab === "standard"
                ? "border-star-blue text-star-blue"
                : "border-transparent text-muted-foreground hover:text-star-navy hover:border-slate-300"
            }`}
            aria-current={activeTab === "standard" ? "page" : undefined}
          >
            Standardrapporter (Pipeline)
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab("predefined")}
            className={`pb-4 text-sm font-semibold border-b-2 px-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue ${
              activeTab === "predefined"
                ? "border-star-blue text-star-blue"
                : "border-transparent text-muted-foreground hover:text-star-navy hover:border-slate-300"
            }`}
            aria-current={activeTab === "predefined" ? "page" : undefined}
          >
            Branche-standarder (KPI&apos;er)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`pb-4 text-sm font-semibold border-b-2 px-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue ${
              activeTab === "custom"
                ? "border-star-blue text-star-blue"
                : "border-transparent text-muted-foreground hover:text-star-navy hover:border-slate-300"
            }`}
            aria-current={activeTab === "custom" ? "page" : undefined}
          >
            Rapportbygger (Custom)
          </button>
        </nav>
      </div>

      {/* Tab Contents */}
      <div className="transition-all duration-200">
        {activeTab === "standard" && <ReportsDashboard />}
        {activeTab === "predefined" && <PredefinedReports />}
        {activeTab === "custom" && <CustomReports />}
      </div>
    </div>
  );
}
