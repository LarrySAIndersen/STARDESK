"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";

import { AvatarPresetIcon } from "@/components/agent/avatar-preset-icon";
import { UserAvatar } from "@/components/agent/user-avatar";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { AVATAR_PRESETS } from "@/lib/avatar-presets";
import { clearSession } from "@/lib/auth";
import {
  AVATAR_UPLOAD_MAX_BYTES,
  selectUserAvatarPreset,
  uploadUserAvatarImage,
  userProfileHref,
} from "@/lib/user-avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type ProfileTab = "heroes" | "upload";

export function ProfileModal({
  user,
  onClose,
  onUserChange,
}: {
  user: User;
  onClose: () => void;
  onUserChange: (user: User) => void;
}) {
  const titleId = useId();
  const panelRef = useFocusTrap(true, onClose);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ProfileTab>("heroes");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatar_url ?? null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    user.avatar_preset_id ?? null,
  );

  const savePreset = useCallback(
    async (presetId: string) => {
      setError(null);
      setSaving(true);
      setSelectedPreset(presetId);
      setPreviewUrl(null);
      try {
        const updated = await selectUserAvatarPreset(user, presetId);
        onUserChange(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke gemme superhelt");
      } finally {
        setSaving(false);
      }
    },
    [onUserChange, user],
  );

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Vælg et billede (JPEG, PNG, WebP eller GIF)");
      return;
    }
    if (file.size > AVATAR_UPLOAD_MAX_BYTES) {
      setError("Billedet må max være ca. 400 KB");
      return;
    }
    setSaving(true);
    try {
      const updated = await uploadUserAvatarImage(user, file);
      setPreviewUrl(updated.avatar_url ?? null);
      setSelectedPreset(null);
      onUserChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke uploade billede");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileOverlay onClose={onClose}>
      <ProfileDialogPanel panelRef={panelRef} titleId={titleId} title="Vælg avatar" onClose={onClose}>
        <p className="text-[11px] text-[var(--gray-mid)]">
          Vælg en superhelt eller upload dit eget billede. Upload har forrang indtil du vælger en
          superhelt igen.
        </p>

        <ProfileTabs tab={tab} onTabChange={setTab} />

        {tab === "heroes" ? (
          <section className="mt-4">
            <h3 className="text-star-navy mb-2 text-xs font-bold">Superhelte</h3>
            <PresetGrid
              selectedPreset={selectedPreset}
              activeUpload={Boolean(user.avatar_url)}
              saving={saving}
              onSelect={(id) => void savePreset(id)}
            />
          </section>
        ) : (
          <section className="mt-4 space-y-3">
            <h3 className="text-star-navy text-xs font-bold">Upload eget billede</h3>
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Forhåndsvisning"
                  className="size-16 rounded-full border border-[var(--gray-border)] object-cover"
                />
              ) : (
                <UserAvatar user={user} size="lg" />
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="sr-only"
                  onChange={(e) => void onFileChange(e)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => fileRef.current?.click()}
                >
                  {saving ? "Uploader…" : "Upload eget billede"}
                </Button>
                <p className="mt-1 text-[10px] text-[var(--gray-mid)]">Max 500 KB</p>
              </div>
            </div>
          </section>
        )}

        {error ? <p className="text-destructive mt-3 text-xs">{error}</p> : null}

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--gray-border)] pt-4">
          <Link
            href={userProfileHref(user)}
            className="text-star-blue text-[11px] font-bold hover:underline"
            onClick={onClose}
          >
            Se mere
          </Link>
          <LogoutButton onDone={onClose} />
        </footer>
      </ProfileDialogPanel>
    </ProfileOverlay>
  );
}

function ProfileOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}

function ProfileDialogPanel({
  panelRef,
  titleId,
  title,
  onClose,
  children,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="bg-background max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border p-5 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-star-navy text-base font-bold">
          {title}
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Luk">
          ✕
        </Button>
      </div>
      {children}
    </div>
  );
}

function ProfileTabs({
  tab,
  onTabChange,
}: {
  tab: ProfileTab;
  onTabChange: (t: ProfileTab) => void;
}) {
  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "heroes", label: "Superhelte" },
    { id: "upload", label: "Upload eget billede" },
  ];
  return (
    <div className="mt-4 flex gap-1 border-b border-[var(--gray-border)]" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={cn(
            "px-3 py-2 text-[11px] font-bold transition-colors",
            tab === t.id
              ? "border-star-red text-star-navy border-b-2"
              : "text-[var(--gray-mid)] hover:text-star-navy",
          )}
          onClick={() => onTabChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function PresetGrid({
  selectedPreset,
  activeUpload,
  saving,
  onSelect,
}: {
  selectedPreset: string | null;
  activeUpload: boolean;
  saving: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {AVATAR_PRESETS.map((preset) => {
        const selected = !activeUpload && selectedPreset === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={saving}
            title={preset.label}
            aria-pressed={selected}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors",
              selected
                ? "border-star-red ring-star-red/30 ring-2"
                : "border-[var(--gray-border)] hover:border-star-blue",
            )}
            onClick={() => onSelect(preset.id)}
          >
            <AvatarPresetIcon presetId={preset.id} size="md" />
            <span className="text-[9px] font-medium text-[var(--gray-mid)]">{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function LogoutButton({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void (async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          clearSession();
          onDone();
          router.push("/login");
          router.refresh();
        })();
      }}
    >
      Log ud
    </Button>
  );
}
