import { apiGetServer } from "@/lib/api-server";
import type { Ticket } from "@/types/ticket";

const CLASSIC_BOARD_TICKETS_PATH =
  "/api/v1/tickets?board=true&limit=500&open_only=true";

/** Open board tickets for classic UI modules (home counts, lists, my-work). */
export async function loadClassicBoardTickets(): Promise<Ticket[]> {
  try {
    return await apiGetServer<Ticket[]>(CLASSIC_BOARD_TICKETS_PATH);
  } catch {
    return [];
  }
}
