import { getAvatarPreset } from "@/lib/avatar-presets";
import { isStaff } from "@/lib/auth";
import { writeUserCookie } from "@/lib/auth";
import type { User } from "@/types/user";

const STORAGE_PREFIX = "stardesk_avatar_";
export const AVATAR_UPLOAD_MAX_BYTES = 400 * 1024;

export type StoredAvatar = {
  avatar_url?: string | null;
  avatar_preset_id?: string | null;
};

export function avatarStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function readStoredAvatar(userId: string): StoredAvatar | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(avatarStorageKey(userId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredAvatar;
  } catch {
    return null;
  }
}

export function writeStoredAvatar(userId: string, data: StoredAvatar): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(avatarStorageKey(userId), JSON.stringify(data));
}

/** Resolve image URL for display (data URL, absolute URL, or BFF proxy). */
export function resolveAvatarImageSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }
  const trimmed = url.trim();
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/api/v1/")) {
    if (typeof window === "undefined") {
      return trimmed;
    }
    return `/api/proxy/${trimmed.slice("/api/".length)}`;
  }
  return trimmed;
}

/** Merge API/cookie user with local prototype overrides. */
export function resolveUserAvatar(user: User | null): User | null {
  if (!user) {
    return null;
  }
  const stored = readStoredAvatar(user.id);
  if (!stored) {
    return user;
  }
  return {
    ...user,
    avatar_url: stored.avatar_url ?? user.avatar_url,
    avatar_preset_id: stored.avatar_preset_id ?? user.avatar_preset_id,
  };
}

export function userInitials(displayName: string): string {
  return displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export type ResolvedAvatarDisplay =
  | { type: "image"; src: string; alt: string }
  | { type: "preset"; presetId: string; label: string }
  | { type: "initials"; initials: string };

/** Custom upload wins over preset until user picks a preset again. */
export function resolveAvatarDisplay(user: User | null): ResolvedAvatarDisplay {
  const merged = resolveUserAvatar(user);
  if (!merged) {
    return { type: "initials", initials: "?" };
  }
  const imageSrc = resolveAvatarImageSrc(merged.avatar_url);
  if (imageSrc) {
    return { type: "image", src: imageSrc, alt: merged.display_name };
  }
  const preset = getAvatarPreset(merged.avatar_preset_id);
  if (preset) {
    return { type: "preset", presetId: preset.id, label: preset.label };
  }
  return { type: "initials", initials: userInitials(merged.display_name) };
}

export function userProfileHref(user: User): string {
  if (isStaff(user)) {
    return `/users/${user.id}`;
  }
  return "/profile";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Kunne ikke læse billedet"));
      }
    };
    reader.onerror = () => reject(new Error("Kunne ikke læse billedet"));
    reader.readAsDataURL(file);
  });
}

async function patchAvatarSession(
  user: User,
  body: { avatar_url: string | null; avatar_preset_id: string | null },
): Promise<User> {
  const response = await fetch("/api/auth/avatar", {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(typeof err.detail === "string" ? err.detail : "Kunne ikke gemme avatar");
  }
  const data = (await response.json()) as { user: User };
  const merged: User = {
    ...user,
    ...data.user,
    role: user.role,
    role_label: data.user.role_label || user.role_label,
  };
  writeUserCookie(merged);
  writeStoredAvatar(user.id, {
    avatar_url: merged.avatar_url ?? null,
    avatar_preset_id: merged.avatar_preset_id ?? null,
  });
  return merged;
}

/** Pick a superhero preset; clears custom upload. */
export async function selectUserAvatarPreset(user: User, presetId: string): Promise<User> {
  return patchAvatarSession(user, { avatar_url: null, avatar_preset_id: presetId });
}

/** Upload profile image via API and sync session cookie + local fallback. */
export async function uploadUserAvatarImage(
  user: User,
  file: File,
): Promise<User> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Vælg en billedfil (PNG, JPG eller WebP).");
  }
  if (file.size > AVATAR_UPLOAD_MAX_BYTES) {
    throw new Error("Billedet er for stort (maks. ca. 400 KB).");
  }

  const avatar_url = await readFileAsDataUrl(file);
  if (avatar_url.length > 500_000) {
    throw new Error("Billedet er for stort efter kodning.");
  }

  return patchAvatarSession(user, { avatar_url, avatar_preset_id: null });
}
