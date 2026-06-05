"use client";

import Link from "next/link";

export interface RiskTicket {
  id: string;
  ticket_number: string;
  title: string;
  priority: string;
  remaining_seconds: number;
  risk_score: number;
}

interface RiskPredictorProps {
  tickets: RiskTicket[];
}

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) {
    return "Overskredet";
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}t`;
  }
  if (hours > 0) {
    return `${hours}t ${minutes}m`;
  }
  return `${minutes}m`;
}

function getPriorityBadgeClass(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

function getPriorityLabelDa(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
      return "Kritisk";
    case "high":
      return "Høj";
    case "medium":
      return "Medium";
    default:
      return "Lav";
  }
}

function getRiskColorClass(score: number) {
  if (score >= 80) return "text-red-600 font-bold";
  if (score >= 50) return "text-orange-600 font-semibold";
  return "text-emerald-600 font-medium";
}

function getRiskBarColorClass(score: number) {
  if (score >= 80) return "bg-red-500";
  if (score >= 50) return "bg-orange-500";
  return "bg-emerald-500";
}

export function RiskPredictor({ tickets }: RiskPredictorProps) {
  return (
    <div className="star-section-card p-6">
      <div>
        <h3 className="text-star-navy text-base font-bold">SLA Overskridelses-risiko (Prediktor)</h3>
        <p className="text-muted-foreground text-xs mt-1">
          Smarte forudsigelser af sager, der er tættest på at overskride deres SLA, vægtet efter prioritet og resterende tid.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="pb-3 pr-4">Sagsnr.</th>
              <th className="pb-3 pr-4">Titel</th>
              <th className="pb-3 pr-4">Prioritet</th>
              <th className="pb-3 pr-4">Resterende SLA</th>
              <th className="pb-3 text-right">Risiko Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                  Ingen åbne sager med SLA forfaldsdato i øjeblikket.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 pr-4 font-mono text-xs font-semibold text-star-blue">
                    <Link href={`/tickets/${ticket.id}`} className="hover:underline">
                      {ticket.ticket_number}
                    </Link>
                  </td>
                  <td className="py-3.5 pr-4 font-medium text-star-navy max-w-xs truncate">
                    <Link href={`/tickets/${ticket.id}`} className="hover:underline" title={ticket.title}>
                      {ticket.title}
                    </Link>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${getPriorityBadgeClass(ticket.priority)}`}>
                      {getPriorityLabelDa(ticket.priority)}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={ticket.remaining_seconds <= 0 ? "text-red-600 font-bold" : "text-star-navy"}>
                      {formatRemainingTime(ticket.remaining_seconds)}
                    </span>
                  </td>
                  <td className="py-3.5 pl-4 text-right">
                    <div className="inline-flex flex-col items-end gap-1 w-24">
                      <span className={getRiskColorClass(ticket.risk_score)}>
                        {ticket.risk_score}%
                      </span>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getRiskBarColorClass(ticket.risk_score)}`}
                          style={{ width: `${ticket.risk_score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
