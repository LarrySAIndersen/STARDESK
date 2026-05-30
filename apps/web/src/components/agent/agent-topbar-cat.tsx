import { cn } from "@/lib/utils";

/** Small comic-style cat for the agent top bar — decorative mascot next to the clock. */
export function AgentTopbarCat({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center drop-shadow-sm", className)}
      data-testid="agent-topbar-cat"
      title="Mjav!"
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <path
          d="M8 14 L6 7 L11 12 Z"
          fill="#F08A24"
          stroke="#1A1A1A"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M24 14 L26 7 L21 12 Z"
          fill="#F08A24"
          stroke="#1A1A1A"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="17" r="9" fill="#F08A24" stroke="#1A1A1A" strokeWidth="1.6" />
        <ellipse cx="16" cy="20" rx="6" ry="4.5" fill="#FFB347" stroke="none" />
        <circle cx="12.5" cy="15.5" r="2.2" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="1.2" />
        <circle cx="19.5" cy="15.5" r="2.2" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="1.2" />
        <circle cx="13" cy="15.5" r="1.1" fill="#1A1A1A" />
        <circle cx="20" cy="15.5" r="1.1" fill="#1A1A1A" />
        <circle cx="13.3" cy="14.9" r="0.35" fill="#FFFFFF" />
        <circle cx="20.3" cy="14.9" r="0.35" fill="#FFFFFF" />
        <path
          d="M14.5 19.5 Q16 20.8 17.5 19.5"
          fill="none"
          stroke="#1A1A1A"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path d="M13 18.5 L11.5 17.5" stroke="#1A1A1A" strokeWidth="1" strokeLinecap="round" />
        <path d="M19 18.5 L20.5 17.5" stroke="#1A1A1A" strokeWidth="1" strokeLinecap="round" />
        <ellipse cx="16" cy="20.5" rx="1.2" ry="0.9" fill="#E07A6A" stroke="#1A1A1A" strokeWidth="0.8" />
        <path
          d="M10 19.5 L7 18.5 M10 21 L7 22 M10 22.5 L7 23.5"
          stroke="#1A1A1A"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <path
          d="M22 19.5 L25 18.5 M22 21 L25 22 M22 22.5 L25 23.5"
          stroke="#1A1A1A"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
