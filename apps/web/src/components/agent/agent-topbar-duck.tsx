import { cn } from "@/lib/utils";

/** Small comic-style duck for the agent top bar — decorative mascot next to the clock. */
export function AgentTopbarDuck({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      title="Quack!"
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-7">
        <ellipse cx="14" cy="20" rx="9" ry="7" fill="#F5D547" stroke="#1A1A1A" strokeWidth="1.6" />
        <circle cx="20" cy="11" r="7" fill="#F5D547" stroke="#1A1A1A" strokeWidth="1.6" />
        <path
          d="M26 11 L31 12.5 L26 14.5 Z"
          fill="#F08A24"
          stroke="#1A1A1A"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="9.5" r="2.4" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="1.2" />
        <circle cx="22.6" cy="9.5" r="1.1" fill="#1A1A1A" />
        <circle cx="22.9" cy="8.9" r="0.35" fill="#FFFFFF" />
        <path
          d="M17 5.5 Q19 3.5 21 5.5"
          fill="none"
          stroke="#1A1A1A"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <ellipse cx="10" cy="21" rx="3.5" ry="2.2" fill="#E8C63A" stroke="#1A1A1A" strokeWidth="1.2" />
        <path
          d="M8 26 L10 24 L12 26"
          fill="#F08A24"
          stroke="#1A1A1A"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M11 27 L13 27"
          stroke="#1A1A1A"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
