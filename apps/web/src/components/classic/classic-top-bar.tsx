import { ClassicTopBarTools } from "@/components/classic/classic-top-bar-tools";
import { ClassicUiSwitcher } from "@/components/classic/classic-ui-switcher";
import { isClassicOnlyUser } from "@/lib/classic-ui-mode";
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
        <span className="classic-topbar__logo">STAR</span>
        <span className="classic-topbar__product">desk — Klassisk visning</span>
      </div>
      <h1 className="classic-topbar__title">{title}</h1>
      <div className="classic-topbar__actions">
        <ClassicTopBarTools user={user} />
        {!isClassicOnlyUser(user?.ui_mode) ? (
          <ClassicUiSwitcher
            targetMode="modern"
            label="Moderne STARdesk"
            className="classic-topbar__switch"
          />
        ) : null}
        {user ? (
          <span className="classic-topbar__user" title={user.email}>
            {user.display_name}
          </span>
        ) : null}
      </div>
    </header>
  );
}
