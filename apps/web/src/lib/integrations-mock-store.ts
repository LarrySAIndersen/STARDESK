import { DEFAULT_INTEGRATIONS } from "@/lib/integrations-config";
import type { IntegrationId, IntegrationsState } from "@/types/integration";

/** In-memory mock for API routes (resets on server restart). */
let serverIntegrations: IntegrationsState = structuredClone(DEFAULT_INTEGRATIONS);

export function getServerIntegrations(): IntegrationsState {
  return structuredClone(serverIntegrations);
}

export function patchServerIntegration<K extends IntegrationId>(
  id: K,
  patch: Partial<IntegrationsState[K]>,
): IntegrationsState {
  serverIntegrations = {
    ...serverIntegrations,
    [id]: { ...serverIntegrations[id], ...patch },
  };
  return getServerIntegrations();
}

export function replaceServerIntegrations(state: IntegrationsState): IntegrationsState {
  serverIntegrations = structuredClone(state);
  return getServerIntegrations();
}
