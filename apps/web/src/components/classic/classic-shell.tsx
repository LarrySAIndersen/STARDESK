import { ClassicSidebar } from "@/components/classic/classic-sidebar";
import { ClassicTopBar } from "@/components/classic/classic-top-bar";
import type { User } from "@/types/user";

export function ClassicShell({
  title,
  user,
  children,
}: {
  title: string;
  user: User | null;
  children: React.ReactNode;
}) {
  return (
    <div className="classic-app flex h-dvh min-h-0 flex-col overflow-hidden">
      <ClassicTopBar title={title} user={user} />
      <div className="classic-body flex min-h-0 flex-1">
        <ClassicSidebar />
        <main id="main-content" className="classic-main min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
