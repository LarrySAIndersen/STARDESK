"use client";

import { useCallback, useEffect, useState } from "react";

import {
  INTEGRATIONS_UPDATED_EVENT,
  loadIntegrationsFromStorage,
} from "@/lib/integrations-config";
import type { IntegrationsState } from "@/types/integration";

export function useIntegrationsConfig(): IntegrationsState {
  const [state, setState] = useState<IntegrationsState>(() => loadIntegrationsFromStorage());

  const refresh = useCallback(() => {
    setState(loadIntegrationsFromStorage());
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "stardesk_integrations") {
        refresh();
      }
    };
    const onCustom = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(INTEGRATIONS_UPDATED_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(INTEGRATIONS_UPDATED_EVENT, onCustom);
    };
  }, [refresh]);

  return state;
}
