"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";

import { useFocusTrap } from "@/hooks/use-focus-trap";
import {
  type ClassicNotificationPreferences,
  saveClassicNotificationPreferences,
} from "@/lib/classic-notification-preferences";

const PREF_FIELDS: {
  key: keyof ClassicNotificationPreferences;
  label: string;
}[] = [
  {
    key: "assignedTaskUpdated",
    label: "En opgave tildelt mig er blevet opdateret",
  },
  {
    key: "bookmarkedTaskUpdated",
    label: "En bogmærket opgave er blevet opdateret",
  },
  {
    key: "taskAssignedToMe",
    label: "En opgave er blevet tildelt mig",
  },
  {
    key: "taskAssignedToMyGroup",
    label: "En opgave er blevet tildelt en af mine ansvarliggrupper",
  },
];

export function ClassicNotificationModal({
  userId,
  initialPrefs,
  onClose,
}: {
  userId: string;
  initialPrefs: ClassicNotificationPreferences;
  onClose: () => void;
}) {
  const titleId = useId();
  const [draft, setDraft] = useState(initialPrefs);
  const panelRef = useFocusTrap(true, onClose);

  function toggle(key: keyof ClassicNotificationPreferences) {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    saveClassicNotificationPreferences(userId, draft);
    onClose();
  }

  function handleCancel() {
    onClose();
  }

  return (
    <div className="classic-modal-backdrop">
      <button
        type="button"
        className="classic-modal-backdrop__dismiss"
        aria-label="Luk dialog"
        onClick={handleCancel}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="classic-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && handleCancel()}
      >
        <header className="classic-modal__header">
          <h2 id={titleId} className="classic-modal__title">
            Notifikation
          </h2>
          <button
            type="button"
            className="classic-modal__close"
            onClick={handleCancel}
            aria-label="Luk"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="classic-modal__body">
          <p className="classic-modal__intro">
            Jeg vil gerne opdateres om sager og simple changes. Notificér mig når:
          </p>
          <ul className="classic-modal__checks">
            {PREF_FIELDS.map(({ key, label }) => (
              <li key={key}>
                <label className="classic-modal__check">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={() => toggle(key)}
                  />
                  <span>{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <footer className="classic-modal__footer">
          <button
            type="button"
            className="classic-modal__btn classic-modal__btn--primary"
            onClick={handleSave}
          >
            Gem
          </button>
          <button
            type="button"
            className="classic-modal__btn classic-modal__btn--secondary"
            onClick={handleCancel}
          >
            Annullér
          </button>
        </footer>
      </div>
    </div>
  );
}
