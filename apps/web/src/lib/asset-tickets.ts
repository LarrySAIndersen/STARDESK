import type { AssetSystem } from "@/types/asset";
import type { Ticket } from "@/types/ticket";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveAssetRecord(
  assetId: string,
  systems: AssetSystem[],
): { name: string; code: string; systemName?: string } | null {
  for (const system of systems) {
    if (system.id === assetId) {
      return { name: system.name, code: system.code };
    }
    const sub = system.subsystems.find((s) => s.id === assetId);
    if (sub) {
      return { name: sub.name, code: sub.code, systemName: system.name };
    }
  }
  return null;
}

/** Match tickets linked to an asset via tags, title or description (until DB asset_id exists). */
export function ticketMatchesAsset(
  ticket: Ticket,
  assetId: string,
  systems: AssetSystem[],
): boolean {
  const asset = resolveAssetRecord(assetId, systems);
  if (!asset) return false;

  const tokens = new Set(
    [
      assetId,
      asset.code,
      asset.name,
      asset.systemName,
      `asset:${assetId}`,
      `aktiv:${asset.code}`,
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalizeToken),
  );

  const tagHit = (ticket.tags ?? []).some((tag) => tokens.has(normalizeToken(tag)));
  if (tagHit) return true;

  const hay = normalizeToken(
    `${ticket.title} ${ticket.description ?? ""} ${ticket.ticket_number}`,
  );
  for (const token of tokens) {
    if (token.length >= 3 && hay.includes(token)) return true;
  }
  return false;
}

export function filterTicketsForAsset(
  tickets: Ticket[],
  assetId: string,
  systems: AssetSystem[],
): Ticket[] {
  return tickets.filter((t) => ticketMatchesAsset(t, assetId, systems));
}
