import { wireStatusBadgeClass } from "@/lib/wireframe-labels";

const BAR_COLORS: Record<string, string> = {
  open: "var(--star-red)",
  progress: "var(--star-blue)",
  pending: "#C87000",
  resolved: "#1A7A44",
};

export function ticketStatusBarColor(status: string): string {
  const variant = wireStatusBadgeClass(status);
  return BAR_COLORS[variant] ?? "var(--star-navy)";
}
