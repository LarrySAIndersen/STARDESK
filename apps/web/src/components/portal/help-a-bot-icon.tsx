"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Gaze = { x: number; y: number };

const HEAD_ROTATE_MAX = 18;
const PUPIL_OFFSET = 2.8;
const STALK_ROTATE_MAX = 22;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance < 1) {
          setGaze({ x: 0, y: 0 });
          return;
        }

        const influence = Math.min(
          1,
          distance / (Math.max(window.innerWidth, window.innerHeight) * 0.35),
        );
        setGaze({
          x: clamp((dx / distance) * influence, -1, 1),
          y: clamp((dy / distance) * influence, -1, 1),
        });
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

function eyeOffset(baseX: number, baseY: number, gaze: Gaze, scale = 1) {
  const ox = gaze.x * PUPIL_OFFSET * scale;
  const oy = gaze.y * PUPIL_OFFSET * scale;
  return {
    cx: baseX + ox,
    cy: baseY + oy,
    hx: baseX + ox - 1.5,
    hy: baseY + oy - 1.5,
  };
}

export function HelpABotIcon({
  className = "size-12",
  trackMouse = true,
}: {
  className?: string;
  trackMouse?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const { containerRef, gaze } = useMouseGaze(trackMouse);
  const headRotate = gaze.x * HEAD_ROTATE_MAX;
  const leftStalkRotate = -8 + gaze.x * STALK_ROTATE_MAX - gaze.y * 4;
  const rightStalkRotate = 8 + gaze.x * STALK_ROTATE_MAX + gaze.y * 4;
  const centerEye = eyeOffset(50, 28, gaze);
  const leftEye = eyeOffset(24, 9, gaze, 0.85);
  const rightEye = eyeOffset(76, 9, gaze, 0.85);

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-center justify-center animate-hover-bob", className)}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes hover-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes flame-flicker { 0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.9; } 50% { transform: scaleY(0.85) scaleX(1.1); opacity: 0.8; } }
        @keyframes eye-pulse { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; filter: drop-shadow(0 0 4px #22d3ee); } }
        .animate-hover-bob { animation: hover-bob 3s ease-in-out infinite; }
        .animate-flame { animation: flame-flicker 0.15s ease-in-out infinite; }
        .animate-eye { animation: eye-pulse 2s ease-in-out infinite; }
      `,
        }}
      />
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

        <g className="animate-flame origin-top">
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
            <circle cx={leftEye.cx} cy={leftEye.cy} r="3.8" fill={`url(#eye-glow-${uid})`} className="animate-eye" />
            <circle cx={leftEye.hx} cy={leftEye.hy} r="1.2" fill="#ffffff" opacity="0.8" />
          </g>
          <g transform={`rotate(${rightStalkRotate} 64 26)`}>
            <path d="M64 26 Q78 14 76 9" fill="none" stroke={`url(#metal-dark-${uid})`} strokeWidth="4" strokeLinecap="round" />
            <circle cx="76" cy="9" r="6.5" fill={`url(#metal-dark-${uid})`} stroke="#334155" strokeWidth="0.5" />
            <circle cx={rightEye.cx} cy={rightEye.cy} r="3.8" fill={`url(#eye-glow-${uid})`} className="animate-eye" />
            <circle cx={rightEye.hx} cy={rightEye.hy} r="1.2" fill="#ffffff" opacity="0.8" />
          </g>
          <circle cx="50" cy="28" r="7.5" fill={`url(#metal-dark-${uid})`} stroke="#334155" strokeWidth="0.5" />
          <circle cx={centerEye.cx} cy={centerEye.cy} r="4.5" fill={`url(#eye-glow-${uid})`} className="animate-eye" />
          <circle cx={centerEye.hx} cy={centerEye.hy} r="1.5" fill="#ffffff" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}
