"use client";

import { AgentBrandHeader } from "@/components/agent/agent-brand-header";
import { AgentSidebar } from "@/components/agent/agent-sidebar";
import { AgentTopBar } from "@/components/agent/agent-top-bar";
import { ResizableSplit } from "@/components/ui/resizable-split";

export function AgentShell({
  children,
  topBarTitle,
}: {
  children: React.ReactNode;
  topBarTitle?: string;
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AgentBrandHeader />

      <ResizableSplit
        storageKey="stardesk-agent-sidebar"
        defaultSizes={[16, 84]}
        minSizes={[12, 50]}
        className="min-h-0 flex-1"
      >
        <AgentSidebar />
        <div className="flex min-h-0 min-w-0 flex-col">
          <AgentTopBar title={topBarTitle} />
          <main className="flex-1 overflow-auto px-6 py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </ResizableSplit>
    </div>
  );
}
