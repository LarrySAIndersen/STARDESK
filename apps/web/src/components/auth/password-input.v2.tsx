"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputV2Props = Omit<React.ComponentProps<typeof Input>, "type"> & {
  inputClassName?: string;
};

export function PasswordInputV2({
  className,
  inputClassName,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...rest
}: PasswordInputV2Props) {
  const [visible, setVisible] = React.useState(false);
  const [capsOn, setCapsOn] = React.useState(false);

  function detectCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!e.getModifierState) {
      return;
    }
    setCapsOn(e.getModifierState("CapsLock"));
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Input
          {...rest}
          type={visible ? "text" : "password"}
          className={cn(
            "h-10 rounded-lg border border-white/10 bg-[#0a0e1a] px-3 pr-11 text-sm text-white placeholder:text-[#64748b] focus-visible:border-[#003F8A] focus-visible:ring-2 focus-visible:ring-[#003F8A]/35 md:text-sm",
            inputClassName,
          )}
          onKeyDown={(e) => {
            detectCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            detectCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsOn(false);
            onBlur?.(e);
          }}
        />
        <button
          type="button"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-[#94a3b8] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[#003F8A]/50"
          aria-label={visible ? "Skjul adgangskode" : "Vis adgangskode"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {capsOn ? (
        <p className="text-xs text-amber-400/90" role="status">
          Caps Lock er aktiveret
        </p>
      ) : null}
    </div>
  );
}
