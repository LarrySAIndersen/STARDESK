export function cvssTier(score: number | undefined): "critical" | "high" | "medium" | "low" | "info" {
  const s = score ?? 0;
  if (s >= 9) return "critical";
  if (s >= 7) return "high";
  if (s >= 4) return "medium";
  if (s > 0) return "low";
  return "info";
}

const TIER_CLASS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-sky-600 text-white",
  info: "bg-gray-400 text-white",
};

const TIER_LABEL: Record<string, string> = {
  critical: "Kritisk",
  high: "Høj",
  medium: "Medium",
  low: "Lav",
  info: "Info",
};

export function severityBadgeClass(severity: string, cvss?: number): string {
  const tier = cvss != null ? cvssTier(cvss) : cvssTier(cvssFromSeverityLabel(severity));
  return TIER_CLASS[tier] ?? TIER_CLASS.info;
}

export function severityBadgeLabel(severity: string, cvss?: number): string {
  const tier = cvss != null ? cvssTier(cvss) : cvssTier(cvssFromSeverityLabel(severity));
  return TIER_LABEL[tier] ?? severity;
}

function cvssFromSeverityLabel(severity: string): number {
  const s = severity.toLowerCase();
  if (s === "critical") return 9.5;
  if (s === "high") return 7.5;
  if (s === "moderate" || s === "medium") return 5.5;
  if (s === "low") return 2.5;
  return 0;
}

export function nvdUrl(cveId: string): string {
  return `https://nvd.nist.gov/vuln/detail/${cveId}`;
}

export function formatAuditTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("da-DK", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
