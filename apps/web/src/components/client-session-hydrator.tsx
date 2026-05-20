"use client";

import { useEffect } from "react";

import { hydrateClientSession } from "@/lib/auth";

/** Loads session user into client cache after navigation (HttpOnly cookies). */
export function ClientSessionHydrator() {
  useEffect(() => {
    void hydrateClientSession();
  }, []);
  return null;
}
