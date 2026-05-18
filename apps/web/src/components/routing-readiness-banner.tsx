import { routingReadinessMessage } from "@/lib/ticket-routing";
import type { TicketRouting } from "@/types/ticket";

export function RoutingReadinessBanner({ routing }: { routing: TicketRouting }) {
  if (routing.routing_ready) {
    return null;
  }
  return (
    <div
      role="status"
      className="rounded-[2px] border border-[#E8C547] bg-[#FFF8E1] px-3 py-2 text-sm text-[#7A5B00]"
    >
      {routingReadinessMessage(routing)}
    </div>
  );
}
