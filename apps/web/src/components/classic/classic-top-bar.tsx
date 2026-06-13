import { ClassicTopBarTools } from "@/components/classic/classic-top-bar-tools";
import { ClassicUiSwitcher } from "@/components/classic/classic-ui-switcher";
import { HistoryBackButton } from "@/components/navigation/history-back-button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User } from "@/types/user";

export function ClassicTopBar({
  title,
  user,
}: {
  title: string;
  user: User | null;
}) {
  return (
    <header className="classic-topbar">
      <div className="classic-topbar__brand">
        <HistoryBackButton compact className="classic-topbar__back" />
        <span className="classic-topbar__logo">STAR</span>
        <span className="classic-topbar__product">desk — Klassisk visning</span>
      </div>
      <h1 className="classic-topbar__title">{title}</h1>
      <div className="classic-topbar__actions">
        <ThemeToggle />
        <ClassicTopBarTools user={user} />
        <ClassicUiSwitcher
          targetMode="modern"
          label="Moderne STARdesk"
          className="classic-topbar__switch"
        />
        {user ? (
          <span className="classic-topbar__user" title={user.email}>
            {user.display_name}
          </span>
        ) : null}
      </div>
    </header>
  );
}
