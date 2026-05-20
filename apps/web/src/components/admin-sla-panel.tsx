"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch } from "@/lib/api";

type SlaPolicy = {
  id: string;
  name: string;
  description: string | null;
  response_time_minutes: number;
  resolution_time_minutes: number;
  business_hours_only: boolean;
  is_active: boolean;
};

type StandardRule = {
  priority: string;
  label_da: string;
  policy_name: string;
  response_kind: string;
  response_amount: number;
  resolution_kind: string;
  resolution_amount: number;
};

export function AdminSlaPanel() {
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [rules, setRules] = useState<StandardRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r] = await Promise.all([
        apiGet<SlaPolicy[]>("/api/v1/admin/sla/policies"),
        apiGet<StandardRule[]>("/api/v1/admin/sla/standard-rules"),
      ]);
      setPolicies(p);
      setRules(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente SLA-data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePolicy(policy: SlaPolicy) {
    setMessage(null);
    setError(null);
    try {
      const updated = await apiPatch<SlaPolicy>(
        `/api/v1/admin/sla/policies/${policy.id}`,
        {
          response_time_minutes: policy.response_time_minutes,
          resolution_time_minutes: policy.resolution_time_minutes,
          business_hours_only: policy.business_hours_only,
          is_active: policy.is_active,
        },
      );
      setPolicies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setMessage(`Gemte ${updated.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme politik");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Henter SLA…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-star-red text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-green-800">{message}</p> : null}

      <section className="wire-card">
        <h2 className="wire-card-title">Standard SLA (P1–P4)</h2>
        <p className="text-muted-foreground mb-3 text-xs">
          Gælder ved oprettelse og når prioritet/sagstype ændres. Incident og service request
          bruger samme beregningsmotor; tilpas DB-politikker nedenfor.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--gray-border)]">
                <th className="py-2 pr-2">Prioritet</th>
                <th className="py-2 pr-2">Respons</th>
                <th className="py-2 pr-2">Løsning</th>
                <th className="py-2">Politik</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.priority} className="border-b border-[var(--gray-border)]/60">
                  <td className="py-2 pr-2 font-medium">{r.label_da}</td>
                  <td className="py-2 pr-2">
                    {r.response_amount}{" "}
                    {r.response_kind === "calendar_hours" ? "t" : "hverdage"}
                  </td>
                  <td className="py-2 pr-2">
                    {r.resolution_amount}{" "}
                    {r.resolution_kind === "calendar_hours" ? "t" : "hverdage"}
                  </td>
                  <td className="py-2">{r.policy_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wire-card">
        <h2 className="wire-card-title">SLA-politikker (database)</h2>
        <p className="text-muted-foreground mb-4 text-xs">
          Rediger minutter for respons og løsning. Ændringer påvirker nye SLA-beregninger på sager.
        </p>
        <div className="space-y-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="grid gap-3 border border-[var(--gray-border)] p-3 md:grid-cols-2 lg:grid-cols-4"
            >
              <div>
                <p className="text-star-navy text-sm font-semibold">{policy.name}</p>
                <p className="text-muted-foreground text-[11px]">{policy.description ?? "—"}</p>
              </div>
              <div>
                <Label className="text-xs">Respons (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={policy.response_time_minutes}
                  onChange={(e) =>
                    setPolicies((prev) =>
                      prev.map((p) =>
                        p.id === policy.id
                          ? { ...p, response_time_minutes: Number(e.target.value) }
                          : p,
                      ),
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Løsning (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={policy.resolution_time_minutes}
                  onChange={(e) =>
                    setPolicies((prev) =>
                      prev.map((p) =>
                        p.id === policy.id
                          ? { ...p, resolution_time_minutes: Number(e.target.value) }
                          : p,
                      ),
                    )
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  className="bg-star-navy w-full"
                  onClick={() => void savePolicy(policy)}
                >
                  Gem
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
