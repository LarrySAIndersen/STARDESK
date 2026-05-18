import { findAssetById } from "@/lib/mock-assets";

/** Build GET /api/v1/tickets query string from dashboard drill-down search params. */

export function buildTicketsApiQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  params.set("limit", "500");

  const scope = pick(searchParams.scope);
  if (scope) {
    params.set("scope", scope);
  }
  if (pick(searchParams.open_only) === "true") {
    params.set("open_only", "true");
  }
  const bucket = pick(searchParams.bucket);
  if (bucket) {
    params.set("bucket", bucket);
  }
  const sla = pick(searchParams.sla);
  if (sla) {
    params.set("sla", sla);
  }
  if (pick(searchParams.major_open) === "true") {
    params.set("major_open", "true");
  }
  const opened = pick(searchParams.opened_since_days);
  if (opened) {
    params.set("opened_since_days", opened);
  }
  const closed = pick(searchParams.closed_since_days);
  if (closed) {
    params.set("closed_since_days", closed);
  }

  const hasDashboardFilter =
    scope || bucket || sla || opened || closed || pick(searchParams.major_open) === "true";

  if (!hasDashboardFilter) {
    params.set("board", "true");
    params.set("open_only", "true");
  }

  return params.toString();
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function dashboardFilterTitle(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const parts: string[] = [];
  const scope = pick(searchParams.scope);
  if (scope === "personal") parts.push("personligt overblik");
  else if (scope === "mine") parts.push("mine sager");
  else if (scope === "group") parts.push("min gruppe");
  else if (scope === "created") parts.push("oprettet af mig");
  else if (scope === "all") parts.push("alle sager");

  const bucket = pick(searchParams.bucket);
  if (bucket === "modtaget") parts.push("modtaget");
  else if (bucket === "igangsat") parts.push("igangsat");
  else if (bucket === "lost") parts.push("løst");
  else if (bucket === "lukket") parts.push("lukket");

  const sla = pick(searchParams.sla);
  if (sla === "overdue") parts.push("SLA overskredet");
  else if (sla === "due_soon") parts.push("SLA inden forfald");

  if (pick(searchParams.major_open) === "true") parts.push("store sager");
  if (pick(searchParams.open_only) === "true" && !bucket && !sla) parts.push("åbne sager");
  if (pick(searchParams.opened_since_days) === "7") parts.push("modtaget seneste 7 d");
  if (pick(searchParams.closed_since_days) === "7") parts.push("lukket seneste 7 d");

  const assetId = pick(searchParams.asset_id);
  if (assetId) {
    const asset = findAssetById(assetId);
    parts.push(asset ? `aktiv: ${asset.label}` : `aktiv: ${assetId}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
