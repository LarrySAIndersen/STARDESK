"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch } from "@/lib/api";

type SlaPolicy = Readonly<{
  id: string;
  name: string;
  description: string | null;
  response_time_minutes: number;
  resolution_time_minutes: number;
  business_hours_only: boolean;
  is_active: boolean;
}>;

type StandardRule = Readonly<{
  priority: string;
  label_da: string;
  policy_name: string;
  response_kind: string;
  response_amount: number;
  resolution_kind: string;
  resolution_amount: number;
}>;

type TeamOption = Readonly<{
  id: string;
  name: string;
}>;

type SlaSettings = Readonly<{
  pause_on_hold: boolean;
  pause_statuses: string[];
  trigger_team_ids: string[];
  sla_starts_on_team_assignment: boolean;
  due_soon_minutes: number;
  teams: TeamOption[];
}>;

const PAUSE_STATUS_OPTIONS = [
  { value: "on_hold", label: "På hold (on_hold)" },
  { value: "pending", label: "Afventer (pending)" },
] as const;

function patchSlaPolicy(
  policies: SlaPolicy[],
  policyId: string,
  patch: Partial<SlaPolicy>,
): SlaPolicy[] {
  return policies.map((policy) =>
    policy.id === policyId ? { ...policy, ...patch } : policy,
  );
}

export function AdminSlaPanel() {
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [rules, setRules] = useState<StandardRule[]>([]);
  const [settings, setSettings] = useState<SlaSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r, s] = await Promise.all([
        apiGet<SlaPolicy[]>("/api/v1/admin/sla/policies"),
        apiGet<StandardRule[]>("/api/v1/admin/sla/standard-rules"),
        apiGet<SlaSettings>("/api/v1/admin/sla/settings"),
      ]);
      setPolicies(p);
      setRules(r);
      setSettings(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente SLA-data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fireAndForget(load());
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

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await apiPatch<SlaSettings>("/api/v1/admin/sla/settings", {
        pause_on_hold: settings.pause_on_hold,
        pause_statuses: settings.pause_statuses,
        trigger_team_ids: settings.trigger_team_ids,
        sla_starts_on_team_assignment: settings.sla_starts_on_team_assignment,
        due_soon_minutes: settings.due_soon_minutes,
      });
      setSettings(updated);
      setMessage("Driftsindstillinger gemt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme indstillinger");
    } finally {
      setSavingSettings(false);
    }
  }

  function toggleTriggerTeam(teamId: string) {
    setSettings((prev) => {
      if (!prev) return prev;
      const selected = new Set(prev.trigger_team_ids);
      if (selected.has(teamId)) {
        selected.delete(teamId);
      } else {
        selected.add(teamId);
      }
      return { ...prev, trigger_team_ids: [...selected] };
    });
  }

  function togglePauseStatus(status: string) {
    setSettings((prev) => {
      if (!prev) return prev;
      const selected = new Set(prev.pause_statuses);
      if (selected.has(status)) {
        if (selected.size <= 1) return prev;
        selected.delete(status);
      } else {
        selected.add(status);
      }
      return { ...prev, pause_statuses: [...selected] };
    });
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

      {settings ? (
        <section className="wire-card">
          <h2 className="wire-card-title">Driftsregler</h2>
          <p className="text-muted-foreground mb-4 text-xs">
            Styr hvornår SLA-timer kører, pauseres og vises på sager og boards. Tom
            gruppe-liste = alle modtagergrupper.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.pause_on_hold}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, pause_on_hold: e.target.checked } : s))
                }
              />
              <span>
                <span className="font-medium">Pause SLA ved på hold</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  Nedtælling stopper og frister forlænges med pausetiden, når sagen forlader
                  pausen.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.sla_starts_on_team_assignment}
                onChange={(e) =>
                  setSettings((s) =>
                    s ? { ...s, sla_starts_on_team_assignment: e.target.checked } : s,
                  )
                }
              />
              <span>
                <span className="font-medium">Start SLA ved gruppetildeling</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  Timer starter først når sagen tildeles en valgt modtagergruppe — ikke ved
                  oprettelse.
                </span>
              </span>
            </label>

            <div>
              <Label className="text-xs">Advarsel før breach (min)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={settings.due_soon_minutes}
                onChange={(e) =>
                  setSettings((s) =>
                    s ? { ...s, due_soon_minutes: Number(e.target.value) } : s,
                  )
                }
              />
            </div>

            <div>
              <Label className="text-xs">Statusser der pauser SLA</Label>
              <div className="mt-1 flex flex-wrap gap-3">
                {PAUSE_STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.pause_statuses.includes(opt.value)}
                      disabled={!settings.pause_on_hold}
                      onChange={() => togglePauseStatus(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Label className="text-xs">SLA gælder for modtagergrupper</Label>
            <p className="text-muted-foreground mb-2 text-[11px]">
              Vælg grupper hvor SLA skal tælle. Ingen valgt = alle grupper.
            </p>
            <div className="flex flex-wrap gap-2">
              {settings.teams.map((team) => {
                const selected = settings.trigger_team_ids.includes(team.id);
                return (
                  <button
                    key={team.id}
                    type="button"
                    className={`rounded border px-2 py-1 text-xs ${
                      selected
                        ? "border-star-navy bg-star-navy text-white"
                        : "border-[var(--gray-border)] bg-white text-star-navy"
                    }`}
                    onClick={() => toggleTriggerTeam(team.id)}
                  >
                    {team.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <Button
              type="button"
              className="bg-star-navy"
              disabled={savingSettings}
              onClick={() => fireAndForget(saveSettings())}
            >
              {savingSettings ? "Gemmer…" : "Gem driftsregler"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="wire-card">
        <h2 className="wire-card-title">Standard SLA (P1–P4)</h2>
        <p className="text-muted-foreground mb-3 text-xs">
          Gælder ved oprettelse og når prioritet/sagstype ændres (medmindre SLA startes ved
          gruppetildeling). Incident og service request bruger samme beregningsmotor.
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
          Rediger minutter for respons og løsning. Ændringer påvirker nye SLA-beregninger på
          sager.
        </p>
        <div className="space-y-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="grid gap-3 border border-[var(--gray-border)] p-3 lg:grid-cols-6"
            >
              <div className="lg:col-span-2">
                <p className="text-star-navy text-sm font-semibold">{policy.name}</p>
                <p className="text-muted-foreground text-[11px]">{policy.description ?? "—"}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={policy.business_hours_only}
                      onChange={(e) =>
                        setPolicies((prev) =>
                          patchSlaPolicy(prev, policy.id, {
                            business_hours_only: e.target.checked,
                          }),
                        )
                      }
                    />
                    Kun hverdage
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={policy.is_active}
                      onChange={(e) =>
                        setPolicies((prev) =>
                          patchSlaPolicy(prev, policy.id, { is_active: e.target.checked }),
                        )
                      }
                    />
                    Aktiv
                  </label>
                </div>
              </div>
              <div>
                <Label className="text-xs">Respons (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={policy.response_time_minutes}
                  onChange={(e) =>
                    setPolicies((prev) =>
                      patchSlaPolicy(prev, policy.id, {
                        response_time_minutes: Number(e.target.value),
                      }),
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
                      patchSlaPolicy(prev, policy.id, {
                        resolution_time_minutes: Number(e.target.value),
                      }),
                    )
                  }
                />
              </div>
              <div className="flex items-end lg:col-span-2">
                <Button
                  type="button"
                  className="bg-star-navy w-full"
                  onClick={() => fireAndForget(savePolicy(policy))}
                >
                  Gem politik
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
