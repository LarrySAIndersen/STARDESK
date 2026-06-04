"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useEffect } from "react";

import { hydrateClientSession } from "@/lib/auth";

/** Loads session user into client cache after navigation (HttpOnly cookies). */
export function ClientSessionHydrator() {
  useEffect(() => {
    fireAndForget(hydrateClientSession());
  }, []);
  return null;
}
