"use client";

import { cn } from "@/lib/utils";
import { PASSWORD_PATTERN } from "@/lib/password-policy";

export type PasswordStrengthLabel = "Svag" | "OK" | "Stærk";

export function getPasswordStrength(
  password: string,
): { filled: 0 | 1 | 2 | 3; label: PasswordStrengthLabel | null } {
  if (!password) {
    return { filled: 0, label: null };
  }

  let filled = 0 as 0 | 1 | 2 | 3;
  if (password.length >= 8) {
    filled = 1;
  }
  if (PASSWORD_PATTERN.test(password)) {
    filled = 2;
  }
  if (
    PASSWORD_PATTERN.test(password) &&
    (password.length >= 12 || (/[a-z]/.test(password) && /[A-Z]/.test(password)))
  ) {
    filled = 3;
  }

  let label: PasswordStrengthLabel | null = null;
  if (filled <= 1) {
    label = "Svag";
  } else if (filled === 2) {
    label = "OK";
  } else {
    label = "Stærk";
  }

  return { filled, label };
}

export function PasswordStrengthMeterV2({ password }: { password: string }) {
  const { filled, label } = getPasswordStrength(password);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5" aria-hidden>
        {([0, 1, 2] as const).map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < filled
                ? filled <= 1
                  ? "bg-[#E8501A]/90"
                  : filled === 2
                    ? "bg-amber-400/90"
                    : "bg-emerald-500/90"
                : "bg-white/10",
            )}
          />
        ))}
      </div>
      {label ? (
        <p className="text-xs text-[#94a3b8]">
          Styrke: <span className="font-medium text-[#cbd5e1]">{label}</span>
        </p>
      ) : (
        <p className="text-xs text-[#64748b]">Styrke vises når du skriver</p>
      )}
    </div>
  );
}
