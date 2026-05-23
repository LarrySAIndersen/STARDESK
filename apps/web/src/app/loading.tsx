import { TicketListSkeleton } from "@/components/ticket-list-skeleton";

/** Route-level loading UI while server components fetch data. */
export default function Loading() {
  return <TicketListSkeleton />;
}
