"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  computeMouseGaze,
  eyeOffset,
  type HelpABotAvatarId,
  isValidHelpABotAvatarId,
} from "@/lib/help-a-bot-avatar-utils";
import { cn } from "@/lib/utils";

export type { HelpABotAvatarId };
export { isValidHelpABotAvatarId };

export type HelpABotAvatarDef = {
  id: HelpABotAvatarId;
  label: string;
};

export const HELP_A_BOT_AVATARS: HelpABotAvatarDef[] = [
  { id: "robot", label: "Robot" },
  { id: "cat", label: "Kat" },
  { id: "dog", label: "Hund" },
  { id: "owl", label: "Ugle" },
  { id: "fox", label: "Ræv" },
  { id: "penguin", label: "Pingvin" },
  { id: "bear", label: "Bjørn" },
  { id: "frog", label: "Frø" },
  { id: "bunny", label: "Kanin" },
  { id: "unicorn", label: "Enhjørning" },
  { id: "dragon", label: "Drage" },
  { id: "fish", label: "Fisk" },
  { id: "bee", label: "Bi" },
  { id: "octopus", label: "Blæksprutte" },
  { id: "rocket", label: "Raket" },
  { id: "star", label: "Stjerne" },
  { id: "coffee", label: "Kaffe" },
  { id: "lightbulb", label: "Pære" },
  { id: "ghost", label: "Spøgelse" },
  { id: "alien", label: "Alien" },
];

export const HELP_A_BOT_AVATAR_STORAGE_KEY = "stardesk-helpabot-avatar";

type Gaze = Readonly<{ x: number; y: number }>;

const HEAD_ROTATE_MAX = 18;
const STALK_ROTATE_MAX = 22;

function useMouseGaze(trackMouse: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: 0 });

  useEffect(() => {
    if (!trackMouse || typeof window === "undefined") return;

    let frame = 0;
    const onMove = (event: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = containerRef.current;
        if (!element) return;

        const rect = element.getBoundingClientRect();
        setGaze(
          computeMouseGaze(
            event.clientX,
            event.clientY,
            rect,
            window.innerWidth,
            window.innerHeight,
          ),
        );
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [trackMouse]);

  return { containerRef, gaze };
}

const AVATAR_ANIM_CSS = `
  @keyframes hab-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes hab-wiggle { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
  @keyframes hab-blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
  @keyframes hab-pulse { 0%, 100% { opacity: 0.85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
  @keyframes hab-flame { 0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.9; } 50% { transform: scaleY(0.85) scaleX(1.1); opacity: 0.8; } }
  @keyframes hab-eye { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; filter: drop-shadow(0 0 4px #22d3ee); } }
  @keyframes hab-wing { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg); } }
  @keyframes hab-tail { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(8deg); } }
  @keyframes hab-sparkle { 0%, 100% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
  @keyframes hab-steam { 0% { opacity: 0.6; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-12px); } }
  @keyframes hab-float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
  .hab-bob { animation: hab-bob 3s ease-in-out infinite; }
  .hab-wiggle { animation: hab-wiggle 2s ease-in-out infinite; }
  .hab-blink { animation: hab-blink 4s ease-in-out infinite; transform-origin: center; }
  .hab-pulse { animation: hab-pulse 2s ease-in-out infinite; }
  .hab-flame { animation: hab-flame 0.15s ease-in-out infinite; transform-origin: bottom; }
  .hab-eye { animation: hab-eye 2s ease-in-out infinite; }
  .hab-wing { animation: hab-wing 0.4s ease-in-out infinite; transform-origin: center; }
  .hab-tail { animation: hab-tail 1.5s ease-in-out infinite; transform-origin: bottom center; }
  .hab-sparkle { animation: hab-sparkle 1.5s ease-in-out infinite; }
  .hab-steam { animation: hab-steam 2s ease-out infinite; }
  .hab-float { animation: hab-float 3s ease-in-out infinite; }
`;

function RobotAvatar({ uid, gaze }: { uid: string; gaze: Gaze }) {
  const headRotate = gaze.x * HEAD_ROTATE_MAX;
  const leftStalkRotate = -8 + gaze.x * STALK_ROTATE_MAX - gaze.y * 4;
  const rightStalkRotate = 8 + gaze.x * STALK_ROTATE_MAX + gaze.y * 4;
  const centerEye = eyeOffset(50, 28, gaze);
  const leftEye = eyeOffset(24, 9, gaze, 0.85);
  const rightEye = eyeOffset(76, 9, gaze, 0.85);

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <defs>
        <radialGradient id={`metal-body-${uid}`} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#cbd5e1" />
          <stop offset="85%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
        <linearGradient id={`metal-dark-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <radialGradient id={`eye-glow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0f7fa" />
          <stop offset="40%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <linearGradient id={`flame-grad-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffedd5" />
          <stop offset="40%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="hab-flame">
        <path d="M42 74 Q50 96 58 74 Z" fill={`url(#flame-grad-${uid})`} />
        <path d="M45 74 Q50 88 55 74 Z" fill="#ffffff" opacity="0.8" />
      </g>
      <rect x="43" y="68" width="14" height="6" rx="2" fill={`url(#metal-dark-${uid})`} stroke="#334155" strokeWidth="0.5" />
      <path d="M26 48 Q10 54 14 68 Q17 70 19 63" fill="none" stroke={`url(#metal-dark-${uid})`} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="14" cy="68" r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="0.5" />
      <path d="M74 48 Q90 54 86 68 Q83 70 81 63" fill="none" stroke={`url(#metal-dark-${uid})`} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="86" cy="68" r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="0.5" />
      <circle cx="50" cy="42" r="24" fill={`url(#metal-body-${uid})`} stroke="#334155" strokeWidth="1" />
      <path d="M31 38 Q50 43 69 38" fill="none" stroke="#334155" strokeWidth="1" opacity="0.5" />
      <path d="M33 48 Q50 53 67 48" fill="none" stroke="#334155" strokeWidth="1" opacity="0.5" />
      <g transform={`rotate(${headRotate} 50 42)`}>
        <g transform={`rotate(${leftStalkRotate} 36 26)`}>
          <path d="M36 26 Q22 14 24 9" fill="none" stroke={`url(#metal-dark-${uid})`} strokeWidth="4" strokeLinecap="round" />
          <circle cx="24" cy="9" r="6.5" fill={`url(#metal-dark-${uid})`} stroke="#334155" strokeWidth="0.5" />
          <circle cx={leftEye.cx} cy={leftEye.cy} r="3.8" fill={`url(#eye-glow-${uid})`} className="hab-eye" />
          <circle cx={leftEye.hx} cy={leftEye.hy} r="1.2" fill="#ffffff" opacity="0.8" />
        </g>
        <g transform={`rotate(${rightStalkRotate} 64 26)`}>
          <path d="M64 26 Q78 14 76 9" fill="none" stroke={`url(#metal-dark-${uid})`} strokeWidth="4" strokeLinecap="round" />
          <circle cx="76" cy="9" r="6.5" fill={`url(#metal-dark-${uid})`} stroke="#334155" strokeWidth="0.5" />
          <circle cx={rightEye.cx} cy={rightEye.cy} r="3.8" fill={`url(#eye-glow-${uid})`} className="hab-eye" />
          <circle cx={rightEye.hx} cy={rightEye.hy} r="1.2" fill="#ffffff" opacity="0.8" />
        </g>
        <circle cx="50" cy="28" r="7.5" fill={`url(#metal-dark-${uid})`} stroke="#334155" strokeWidth="0.5" />
        <circle cx={centerEye.cx} cy={centerEye.cy} r="4.5" fill={`url(#eye-glow-${uid})`} className="hab-eye" />
        <circle cx={centerEye.hx} cy={centerEye.hy} r="1.5" fill="#ffffff" opacity="0.8" />
      </g>
    </svg>
  );
}

function CatAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 42, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <path d="M28 38 L22 18 L38 32 Z" fill="#f97316" stroke="#c2410c" strokeWidth="1" />
      <path d="M72 38 L78 18 L62 32 Z" fill="#f97316" stroke="#c2410c" strokeWidth="1" />
      <ellipse cx="50" cy="52" rx="28" ry="26" fill="#fb923c" stroke="#c2410c" strokeWidth="1" />
      <ellipse cx="50" cy="58" rx="14" ry="10" fill="#fed7aa" />
      <g className="hab-blink">
        <ellipse cx={eye.cx - 10} cy={eye.cy} rx="5" ry="6" fill="#1e293b" />
        <ellipse cx={eye.cx + 10} cy={eye.cy} rx="5" ry="6" fill="#1e293b" />
        <circle cx={eye.cx - 10} cy={eye.cy - 1} r="1.5" fill="#fff" />
        <circle cx={eye.cx + 10} cy={eye.cy - 1} r="1.5" fill="#fff" />
      </g>
      <path d="M46 52 Q50 56 54 52" fill="none" stroke="#c2410c" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M38 48 L42 50 M62 48 L58 50" stroke="#c2410c" strokeWidth="1" strokeLinecap="round" />
      <path d="M50 56 L48 60 M50 56 L52 60" stroke="#c2410c" strokeWidth="1" strokeLinecap="round" />
      <path className="hab-tail" d="M74 58 Q92 48 88 72 Q84 78 76 68" fill="none" stroke="#f97316" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function DogAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 40, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <ellipse cx="50" cy="55" rx="26" ry="24" fill="#a16207" stroke="#713f12" strokeWidth="1" />
      <ellipse cx="28" cy="48" rx="10" ry="14" fill="#ca8a04" stroke="#713f12" strokeWidth="1" />
      <ellipse cx="72" cy="48" rx="10" ry="14" fill="#ca8a04" stroke="#713f12" strokeWidth="1" />
      <ellipse cx="50" cy="62" rx="12" ry="9" fill="#fde68a" />
      <circle cx={eye.cx - 9} cy={eye.cy} r="4" fill="#1e293b" />
      <circle cx={eye.cx + 9} cy={eye.cy} r="4" fill="#1e293b" />
      <ellipse cx="50" cy="52" rx="5" ry="4" fill="#1e293b" />
      <path d="M44 66 Q50 72 56 66" fill="none" stroke="#713f12" strokeWidth="2" strokeLinecap="round" />
      <path className="hab-wiggle" d="M72 62 Q88 58 90 48" fill="none" stroke="#a16207" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function OwlAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 44, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <ellipse cx="50" cy="55" rx="30" ry="32" fill="#78350f" stroke="#451a03" strokeWidth="1" />
      <circle cx="35" cy="42" r="14" fill="#fef3c7" stroke="#451a03" strokeWidth="1" />
      <circle cx="65" cy="42" r="14" fill="#fef3c7" stroke="#451a03" strokeWidth="1" />
      <circle cx={eye.cx - 15} cy={eye.cy - 2} r="6" fill="#1e293b" />
      <circle cx={eye.cx + 15} cy={eye.cy - 2} r="6" fill="#1e293b" />
      <path d="M50 52 L46 58 L54 58 Z" fill="#f59e0b" />
      <path d="M38 68 Q50 74 62 68" fill="none" stroke="#451a03" strokeWidth="1" opacity="0.5" />
      <path className="hab-blink" d="M32 28 Q50 18 68 28" fill="none" stroke="#451a03" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FoxAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 42, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <path d="M30 40 L18 12 L42 32 Z" fill="#ea580c" stroke="#9a3412" strokeWidth="1" />
      <path d="M70 40 L82 12 L58 32 Z" fill="#ea580c" stroke="#9a3412" strokeWidth="1" />
      <ellipse cx="50" cy="54" rx="26" ry="24" fill="#f97316" stroke="#9a3412" strokeWidth="1" />
      <ellipse cx="50" cy="60" rx="12" ry="10" fill="#fff" />
      <circle cx={eye.cx - 9} cy={eye.cy} r="3.5" fill="#1e293b" />
      <circle cx={eye.cx + 9} cy={eye.cy} r="3.5" fill="#1e293b" />
      <circle cx="50" cy="52" r="3" fill="#1e293b" />
      <path className="hab-tail" d="M74 58 Q95 40 88 20" fill="none" stroke="#ea580c" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function PenguinAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 38, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <ellipse cx="50" cy="58" rx="24" ry="30" fill="#1e293b" />
      <ellipse cx="50" cy="60" rx="16" ry="22" fill="#fff" />
      <circle cx="50" cy="28" r="18" fill="#1e293b" />
      <circle cx={eye.cx - 7} cy={eye.cy} r="3" fill="#fff" />
      <circle cx={eye.cx + 7} cy={eye.cy} r="3" fill="#fff" />
      <path d="M46 34 L50 42 L54 34 Z" fill="#f59e0b" />
      <ellipse className="hab-wiggle" cx="28" cy="58" rx="8" ry="14" fill="#1e293b" transform="rotate(-20 28 58)" />
      <ellipse className="hab-wiggle" cx="72" cy="58" rx="8" ry="14" fill="#1e293b" transform="rotate(20 72 58)" style={{ animationDelay: "0.2s" }} />
    </svg>
  );
}

function BearAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 44, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <circle cx="28" cy="30" r="12" fill="#92400e" stroke="#451a03" strokeWidth="1" />
      <circle cx="72" cy="30" r="12" fill="#92400e" stroke="#451a03" strokeWidth="1" />
      <circle cx="50" cy="52" r="28" fill="#b45309" stroke="#451a03" strokeWidth="1" />
      <ellipse cx="50" cy="58" rx="14" ry="10" fill="#fde68a" />
      <circle cx={eye.cx - 10} cy={eye.cy} r="3" fill="#1e293b" />
      <circle cx={eye.cx + 10} cy={eye.cy} r="3" fill="#1e293b" />
      <ellipse cx="50" cy="52" rx="5" ry="4" fill="#451a03" />
      <path d="M44 64 Q50 68 56 64" fill="none" stroke="#451a03" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FrogAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 32, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <ellipse cx="50" cy="58" rx="32" ry="26" fill="#22c55e" stroke="#15803d" strokeWidth="1" />
      <circle cx="32" cy="38" r="12" fill="#22c55e" stroke="#15803d" strokeWidth="1" />
      <circle cx="68" cy="38" r="12" fill="#22c55e" stroke="#15803d" strokeWidth="1" />
      <circle cx={eye.cx - 18} cy={eye.cy} r="5" fill="#fff" />
      <circle cx={eye.cx + 18} cy={eye.cy} r="5" fill="#fff" />
      <circle cx={eye.cx - 18} cy={eye.cy} r="2.5" fill="#1e293b" />
      <circle cx={eye.cx + 18} cy={eye.cy} r="2.5" fill="#1e293b" />
      <path d="M38 62 Q50 70 62 62" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="50" cy="72" rx="8" ry="4" fill="#15803d" opacity="0.4" />
    </svg>
  );
}

function BunnyAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 48, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <ellipse className="hab-wiggle" cx="38" cy="22" rx="8" ry="22" fill="#fbcfe8" stroke="#db2777" strokeWidth="1" />
      <ellipse className="hab-wiggle" cx="62" cy="22" rx="8" ry="22" fill="#fbcfe8" stroke="#db2777" strokeWidth="1" style={{ animationDelay: "0.15s" }} />
      <circle cx="50" cy="55" r="26" fill="#fce7f3" stroke="#db2777" strokeWidth="1" />
      <circle cx={eye.cx - 8} cy={eye.cy} r="3" fill="#1e293b" />
      <circle cx={eye.cx + 8} cy={eye.cy} r="3" fill="#1e293b" />
      <ellipse cx="50" cy="58" rx="4" ry="3" fill="#f472b6" />
      <path d="M44 64 Q50 68 56 64" fill="none" stroke="#db2777" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function UnicornAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(52, 44, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <path d="M48 18 L52 42 L56 18 Z" fill="#c084fc" stroke="#7c3aed" strokeWidth="1" />
      <circle cx="50" cy="52" r="26" fill="#fff" stroke="#c084fc" strokeWidth="1.5" />
      <circle cx={eye.cx - 9} cy={eye.cy} r="3" fill="#1e293b" />
      <circle cx={eye.cx + 9} cy={eye.cy} r="3" fill="#1e293b" />
      <path d="M44 58 Q50 62 56 58" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" />
      <circle className="hab-sparkle" cx="72" cy="28" r="3" fill="#fde047" />
      <circle className="hab-sparkle" cx="24" cy="36" r="2" fill="#f472b6" style={{ animationDelay: "0.5s" }} />
      <path className="hab-tail" d="M72 58 Q90 48 88 30" fill="none" stroke="#c084fc" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function DragonAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(48, 42, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <ellipse cx="50" cy="54" rx="28" ry="26" fill="#16a34a" stroke="#14532d" strokeWidth="1" />
      <path d="M22 40 L8 20 L28 36 Z" fill="#16a34a" stroke="#14532d" strokeWidth="1" />
      <circle cx={eye.cx - 10} cy={eye.cy} r="4" fill="#fef08a" />
      <circle cx={eye.cx - 10} cy={eye.cy} r="2" fill="#1e293b" />
      <path d="M58 48 Q68 38 78 42" fill="none" stroke="#14532d" strokeWidth="2" strokeLinecap="round" />
      <path className="hab-flame" d="M78 42 Q88 32 84 52 Q80 48 78 42" fill="#f97316" />
      <path className="hab-tail" d="M74 62 Q92 72 88 88" fill="none" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function FishAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(58, 46, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none hab-wiggle" aria-hidden="true">
      <ellipse cx="52" cy="50" rx="28" ry="18" fill="#38bdf8" stroke="#0369a1" strokeWidth="1" />
      <path d="M18 50 L32 38 L32 62 Z" fill="#0ea5e9" stroke="#0369a1" strokeWidth="1" />
      <circle cx={eye.cx} cy={eye.cy} r="4" fill="#fff" />
      <circle cx={eye.cx + 1} cy={eye.cy} r="2" fill="#1e293b" />
      <path d="M40 58 Q52 64 64 58" fill="none" stroke="#0369a1" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function BeeAvatar() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <ellipse cx="50" cy="52" rx="22" ry="20" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
      <rect x="32" y="44" width="36" height="6" fill="#1e293b" rx="1" />
      <rect x="34" y="54" width="32" height="6" fill="#1e293b" rx="1" />
      <circle cx="50" cy="32" r="14" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
      <circle cx="44" cy="30" r="3" fill="#1e293b" />
      <circle cx="56" cy="30" r="3" fill="#1e293b" />
      <path className="hab-wing" d="M28 38 Q18 28 28 22 Q38 28 28 38" fill="#fff" opacity="0.7" stroke="#94a3b8" strokeWidth="0.5" />
      <path className="hab-wing" d="M72 38 Q82 28 72 22 Q62 28 72 38" fill="#fff" opacity="0.7" stroke="#94a3b8" strokeWidth="0.5" style={{ animationDelay: "0.2s" }} />
    </svg>
  );
}

function OctopusAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 38, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <circle cx="50" cy="38" r="22" fill="#a855f7" stroke="#6b21a8" strokeWidth="1" />
      <circle cx={eye.cx - 8} cy={eye.cy} r="4" fill="#fff" />
      <circle cx={eye.cx + 8} cy={eye.cy} r="4" fill="#fff" />
      <circle cx={eye.cx - 8} cy={eye.cy} r="2" fill="#1e293b" />
      <circle cx={eye.cx + 8} cy={eye.cy} r="2" fill="#1e293b" />
      {[30, 40, 50, 60, 70].map((x, i) => (
        <path
          key={x}
          className="hab-wiggle"
          d={`M${x} 58 Q${x + (i - 2) * 4} 78 ${x} 92`}
          fill="none"
          stroke="#a855f7"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </svg>
  );
}

function RocketAvatar() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none hab-float" aria-hidden="true">
      <path d="M50 12 Q58 40 54 68 L46 68 Q42 40 50 12" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
      <circle cx="50" cy="38" r="8" fill="#38bdf8" stroke="#0369a1" strokeWidth="1" className="hab-pulse" />
      <path d="M46 68 L38 82 L46 72 Z" fill="#ef4444" />
      <path d="M54 68 L62 82 L54 72 Z" fill="#ef4444" />
      <g className="hab-flame">
        <path d="M46 72 Q50 88 54 72" fill="#f97316" />
        <path d="M47 72 Q50 82 53 72" fill="#fde047" />
      </g>
    </svg>
  );
}

function StarAvatar() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none hab-pulse" aria-hidden="true">
      <polygon points="50,8 61,38 92,38 67,56 76,86 50,68 24,86 33,56 8,38 39,38" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
      <circle className="hab-sparkle" cx="72" cy="24" r="3" fill="#fff" />
      <circle className="hab-sparkle" cx="28" cy="72" r="2" fill="#fff" style={{ animationDelay: "0.7s" }} />
    </svg>
  );
}

function CoffeeAvatar() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <path d="M28 38 L32 72 Q50 78 68 72 L72 38 Z" fill="#78350f" stroke="#451a03" strokeWidth="1" />
      <ellipse cx="50" cy="38" rx="22" ry="6" fill="#92400e" stroke="#451a03" strokeWidth="1" />
      <path d="M72 44 Q88 44 88 56 Q88 64 72 64" fill="none" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
      <path className="hab-steam" d="M42 28 Q44 18 42 8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path className="hab-steam" d="M50 26 Q52 14 50 4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" style={{ animationDelay: "0.5s" }} />
      <path className="hab-steam" d="M58 28 Q60 18 58 8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" style={{ animationDelay: "1s" }} />
    </svg>
  );
}

function LightbulbAvatar() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none hab-pulse" aria-hidden="true">
      <path d="M50 12 Q72 12 72 38 Q72 52 62 58 L62 68 L38 68 L38 58 Q28 52 28 38 Q28 12 50 12" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
      <rect x="38" y="68" width="24" height="8" rx="2" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
      <rect x="40" y="76" width="20" height="6" rx="1" fill="#64748b" />
      <path d="M44 48 L50 38 L56 48" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function GhostAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 42, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none hab-float" aria-hidden="true">
      <path d="M50 18 Q78 18 78 48 L78 82 Q72 76 66 82 Q60 76 54 82 Q48 76 42 82 Q36 76 30 82 Q24 76 22 82 L22 48 Q22 18 50 18" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" opacity="0.95" />
      <ellipse cx={eye.cx - 10} cy={eye.cy} rx="5" ry="7" fill="#1e293b" />
      <ellipse cx={eye.cx + 10} cy={eye.cy} rx="5" ry="7" fill="#1e293b" />
      <ellipse cx="50" cy="58" rx="6" ry="4" fill="#94a3b8" opacity="0.5" />
    </svg>
  );
}

function AlienAvatar({ gaze }: { gaze: Gaze }) {
  const eye = eyeOffset(50, 44, gaze);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" aria-hidden="true">
      <ellipse cx="50" cy="52" rx="26" ry="30" fill="#4ade80" stroke="#15803d" strokeWidth="1" />
      <ellipse cx={eye.cx - 12} cy={eye.cy - 4} rx="8" ry="10" fill="#1e293b" />
      <ellipse cx={eye.cx + 12} cy={eye.cy - 4} rx="8" ry="10" fill="#1e293b" />
      <circle cx={eye.cx - 12} cy={eye.cy - 6} r="2" fill="#fff" />
      <circle cx={eye.cx + 12} cy={eye.cy - 6} r="2" fill="#fff" />
      <path d="M44 62 Q50 66 56 62" fill="none" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" />
      <path className="hab-antenna" d="M38 28 Q30 12 24 8" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="8" r="3" fill="#22d3ee" className="hab-pulse" />
    </svg>
  );
}

function AvatarInner({ avatarId, uid, gaze }: { avatarId: HelpABotAvatarId; uid: string; gaze: Gaze }) {
  switch (avatarId) {
    case "robot":
      return <RobotAvatar uid={uid} gaze={gaze} />;
    case "cat":
      return <CatAvatar gaze={gaze} />;
    case "dog":
      return <DogAvatar gaze={gaze} />;
    case "owl":
      return <OwlAvatar gaze={gaze} />;
    case "fox":
      return <FoxAvatar gaze={gaze} />;
    case "penguin":
      return <PenguinAvatar gaze={gaze} />;
    case "bear":
      return <BearAvatar gaze={gaze} />;
    case "frog":
      return <FrogAvatar gaze={gaze} />;
    case "bunny":
      return <BunnyAvatar gaze={gaze} />;
    case "unicorn":
      return <UnicornAvatar gaze={gaze} />;
    case "dragon":
      return <DragonAvatar gaze={gaze} />;
    case "fish":
      return <FishAvatar gaze={gaze} />;
    case "bee":
      return <BeeAvatar />;
    case "octopus":
      return <OctopusAvatar gaze={gaze} />;
    case "rocket":
      return <RocketAvatar />;
    case "star":
      return <StarAvatar />;
    case "coffee":
      return <CoffeeAvatar />;
    case "lightbulb":
      return <LightbulbAvatar />;
    case "ghost":
      return <GhostAvatar gaze={gaze} />;
    case "alien":
      return <AlienAvatar gaze={gaze} />;
    default:
      return <RobotAvatar uid={uid} gaze={gaze} />;
  }
}

export function HelpABotAvatar({
  avatarId = "robot",
  className = "size-12",
  trackMouse = true,
}: {
  avatarId?: HelpABotAvatarId;
  className?: string;
  trackMouse?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const { containerRef, gaze } = useMouseGaze(trackMouse);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-center justify-center hab-bob", className)}
    >
      <style dangerouslySetInnerHTML={{ __html: AVATAR_ANIM_CSS }} />
      <AvatarInner avatarId={avatarId} uid={uid} gaze={gaze} />
    </div>
  );
}

