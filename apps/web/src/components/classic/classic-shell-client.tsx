"use client";

import { ClassicTopBar } from "@/components/classic/classic-top-bar";
import { ClassicSidebar } from "@/components/classic/classic-sidebar";
import { ClassicWorkTabs } from "@/components/classic/classic-work-tabs";
import { ClassicWorkTabsProvider } from "@/components/classic/classic-work-tabs-context";
import type { User } from "@/types/user";

export function ClassicShellClient({
  title,
  user,
  children,
}: {
  title: string;
  user: User | null;
  children: React.ReactNode;
}) {
  return (
    <ClassicWorkTabsProvider userId={user?.id ?? null}>
      <div className="classic-app flex h-dvh min-h-0 flex-col overflow-hidden">
        <ClassicTopBar title={title} user={user} />
        <ClassicWorkTabs />
        <div className="classic-body flex min-h-0 flex-1">
          <ClassicSidebar />
          <main id="main-content" className="classic-main min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ClassicWorkTabsProvider>
  );
}
