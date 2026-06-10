"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  HELP_A_BOT_AVATARS,
  HelpABotAvatar,
  type HelpABotAvatarId,
} from "@/components/portal/help-a-bot-avatars";

export function HelpABotAvatarPicker({
  open,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedId: HelpABotAvatarId;
  onSelect: (id: HelpABotAvatarId) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[450] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="V\u00e6lg Help-a-bot avatar"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Luk"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-100">V\u00e6lg avatar</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Dobbeltklik p\u00e5 Help-a-bot for at skifte udseende
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Luk"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {HELP_A_BOT_AVATARS.map((avatar) => {
            const isSelected = avatar.id === selectedId;
            return (
              <button
                key={avatar.id}
                type="button"
                title={avatar.label}
                onClick={() => {
                  onSelect(avatar.id);
                  onClose();
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-2 transition-all",
                  isSelected
                    ? "border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/50"
                    : "border-slate-600 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-700/60",
                )}
              >
                <HelpABotAvatar avatarId={avatar.id} className="size-10" trackMouse={false} />
                <span className="max-w-full truncate text-[9px] font-medium text-slate-300">
                  {avatar.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}