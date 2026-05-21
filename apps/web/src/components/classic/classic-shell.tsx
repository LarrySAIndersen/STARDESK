import { ClassicShellClient } from "@/components/classic/classic-shell-client";
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
    <ClassicShellClient title={title} user={user}>
      {children}
    </ClassicShellClient>
  );
}
