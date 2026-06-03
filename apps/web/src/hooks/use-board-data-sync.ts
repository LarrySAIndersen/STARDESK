"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { apiGet } from "@/lib/api";
import { reconcileLocalTicketsWithServer } from "@/lib/ticket-assignment";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

/** Fired after ticket create/update so open dispatch views refresh immediately. */
export const BOARD_TICKETS_CHANGED = "stardesk:tickets-changed";

export const BOARD_POLL_MS = 30_000;

export function dispatchBoardTicketsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BOARD_TICKETS_CHANGED));
  }
}

export function useBoardDataSync({
  setTickets,
  setTeams,
  onError,
}: {
  setTickets: Dispatch<SetStateAction<Ticket[]>>;
  setTeams?: Dispatch<SetStateAction<Team[]>>;
  onError?: (message: string | null) => void;
}): { refreshNow: () => Promise<void> } {
  const syncingRef = useRef(false);

  const refreshNow = useCallback(async () => {
    if (syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    try {
      const fetches: [
        Promise<Ticket[]>,
        Promise<Team[] | null>,
      ] = [
        apiGet<Ticket[]>("/api/v1/tickets?board=true&limit=500"),
        setTeams
          ? apiGet<Team[]>("/api/v1/teams")
          : Promise.resolve(null),
      ];
      const [freshTickets, freshTeams] = await Promise.all(fetches);
      setTickets((prev) => reconcileLocalTicketsWithServer(prev, freshTickets));
      if (freshTeams && setTeams) {
        setTeams(freshTeams);
      }
      onError?.(null);
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : "Kunne ikke opdatere sager. Viser seneste kendte data.",
      );
    } finally {
      syncingRef.current = false;
    }
  }, [setTickets, setTeams, onError]);

  useEffect(() => {
    void refreshNow();
    const intervalId = window.setInterval(() => {
      void refreshNow();
    }, BOARD_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshNow();
      }
    };
    const onChanged = () => {
      void refreshNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(BOARD_TICKETS_CHANGED, onChanged);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(BOARD_TICKETS_CHANGED, onChanged);
    };
  }, [refreshNow]);

  return { refreshNow };
}
