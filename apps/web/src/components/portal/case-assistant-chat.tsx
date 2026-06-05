"use client";

import { useState } from "react";
import { X, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { isStaff } from "@/lib/auth";
import type { User } from "@/types/user";

function HelpABotIcon() {
  return (
    <div className="relative size-12 flex items-center justify-center animate-hover-bob">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hover-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes flame-flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.9; }
          25% { transform: scaleY(1.2) scaleX(0.9); opacity: 1; }
          50% { transform: scaleY(0.85) scaleX(1.1); opacity: 0.8; }
          75% { transform: scaleY(1.1) scaleX(0.95); opacity: 0.95; }
        }
        @keyframes eye-pulse {
          0%, 100% { opacity: 0.85; filter: drop-shadow(0 0 1px #22d3ee); }
          50% { opacity: 1; filter: drop-shadow(0 0 4px #22d3ee); }
        }
        .animate-hover-bob {
          animation: hover-bob 3s ease-in-out infinite;
        }
        .animate-flame {
          animation: flame-flicker 0.15s ease-in-out infinite;
        }
        .animate-eye {
          animation: eye-pulse 2s ease-in-out infinite;
        }
      `}} />
      <svg viewBox="0 0 100 100" className="w-full h-full select-none" aria-hidden="true">
        <defs>
          <radialGradient id="metal-body" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#cbd5e1" />
            <stop offset="85%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>
          
          <linearGradient id="metal-dark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <radialGradient id="eye-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e0f7fa" />
            <stop offset="40%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </radialGradient>

          <linearGradient id="flame-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="40%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Flame thruster */}
        <g className="animate-flame origin-top">
          <path d="M42 74 Q50 96 58 74 Z" fill="url(#flame-grad)" />
          <path d="M45 74 Q50 88 55 74 Z" fill="#ffffff" opacity="0.8" />
        </g>

        {/* Thruster nozzle */}
        <rect x="43" y="68" width="14" height="6" rx="2" fill="url(#metal-dark)" stroke="#334155" strokeWidth="0.5" />

        {/* Mechanical Arms */}
        {/* Left Arm */}
        <path d="M26 48 Q10 54 14 68 Q17 70 19 63" fill="none" stroke="url(#metal-dark)" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="14" cy="68" r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="0.5" />
        {/* Right Arm */}
        <path d="M74 48 Q90 54 86 68 Q83 70 81 63" fill="none" stroke="url(#metal-dark)" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="86" cy="68" r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="0.5" />

        {/* Spherical Main Body */}
        <circle cx="50" cy="42" r="24" fill="url(#metal-body)" stroke="#334155" strokeWidth="1" />

        {/* Body details / plates */}
        <path d="M31 38 Q50 43 69 38" fill="none" stroke="#334155" strokeWidth="1" opacity="0.5" />
        <path d="M33 48 Q50 53 67 48" fill="none" stroke="#334155" strokeWidth="1" opacity="0.5" />

        {/* Optic Sensor Stalks */}
        {/* Left Eye Stalk */}
        <path d="M36 26 Q22 14 24 9" fill="none" stroke="url(#metal-dark)" strokeWidth="4" strokeLinecap="round" />
        {/* Right Eye Stalk */}
        <path d="M64 26 Q78 14 76 9" fill="none" stroke="url(#metal-dark)" strokeWidth="4" strokeLinecap="round" />

        {/* Optic Sensors (Eyes) */}
        {/* Center Eye */}
        <circle cx="50" cy="28" r="7.5" fill="url(#metal-dark)" stroke="#334155" strokeWidth="0.5" />
        <circle cx="50" cy="28" r="4.5" fill="url(#eye-glow)" className="animate-eye" />
        <circle cx="48.5" cy="26.5" r="1.5" fill="#ffffff" opacity="0.8" />

        {/* Left Eye */}
        <circle cx="24" cy="9" r="6.5" fill="url(#metal-dark)" stroke="#334155" strokeWidth="0.5" />
        <circle cx="24" cy="9" r="3.8" fill="url(#eye-glow)" className="animate-eye" />
        <circle cx="22.5" cy="7.5" r="1.2" fill="#ffffff" opacity="0.8" />

        {/* Right Eye */}
        <circle cx="76" cy="9" r="6.5" fill="url(#metal-dark)" stroke="#334155" strokeWidth="0.5" />
        <circle cx="76" cy="9" r="3.8" fill="url(#eye-glow)" className="animate-eye" />
        <circle cx="74.5" cy="7.5" r="1.2" fill="#ffffff" opacity="0.8" />
      </svg>
    </div>
  );
}

export function CaseAssistantChat({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);

  const librechatUrl = process.env.NEXT_PUBLIC_LIBRECHAT_URL || "http://localhost:3080";
  const staff = isStaff(user);

  const botName = staff ? "Help-a-bot" : "Sag-assistent";
  const botSub = staff 
    ? "Spørg om systemer, fagsager og procedurer" 
    : "Spørg om dine sager, systemer og vejledninger";
  const fabLabel = staff ? "Help-a-bot" : "Spørg om sager";

  return (
    <>
      <button
        type="button"
        className={cn(
          staff
            ? "fixed right-5 bottom-[5.25rem] z-[399] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition-all hover:scale-[1.05] bg-gradient-to-r from-slate-700 to-slate-800 text-slate-100 border border-slate-600 hover:from-slate-600 hover:to-slate-700"
            : cn("case-assistant-fab", open && "case-assistant-fab--open")
        )}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={botName}
      >
        {staff ? (
          <HelpABotIcon />
        ) : (
          <Bot className="size-5 shrink-0" aria-hidden />
        )}
        <span className={cn(!staff && "case-assistant-fab-label", "font-semibold")}>
          {fabLabel}
        </span>
      </button>

      {open ? (
        <div
          className="case-assistant-panel"
          role="dialog"
          aria-label={botName}
        >
          <header className={cn(
            staff
              ? "bg-gradient-to-r from-slate-800 to-slate-900 relative px-4 py-3.5 pr-10 text-slate-100 border-b border-slate-700"
              : "case-assistant-panel-header"
          )}>
            <div>
              <p className={cn(staff ? "text-sm font-bold tracking-tight text-slate-100" : "case-assistant-panel-title")}>
                {botName}
              </p>
              <p className={cn(staff ? "mt-0.5 text-[11px] text-slate-400" : "case-assistant-panel-sub")}>
                {botSub}
              </p>
            </div>
            <button
              type="button"
              className="case-assistant-panel-close"
              onClick={() => setOpen(false)}
              aria-label="Luk"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="w-full h-[450px] overflow-hidden bg-white">
            <iframe
              src={`${librechatUrl}/?embed=true`}
              className="w-full h-full border-none"
              title={botName}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
