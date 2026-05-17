import { AgentSidebar } from "@/components/agent/agent-sidebar";
import { AgentTopBar } from "@/components/agent/agent-top-bar";

export function AgentShell({
  children,
  topBarTitle,
}: {
  children: React.ReactNode;
  topBarTitle?: string;
}) {
  return (
    <section className="bg-background flex min-h-screen">
      <AgentSidebar />
      <section className="flex min-w-0 flex-1 flex-col">
        <AgentTopBar title={topBarTitle} />
        <main className="flex-1 overflow-auto px-6 py-6 lg:px-8 lg:py-8">{children}</main>
      </section>
    </section>
  );
}
