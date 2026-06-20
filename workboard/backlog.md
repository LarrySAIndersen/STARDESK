# STARDESK backlog

Opdateret: 2026-06-20. Git-spejlet backlog til chat + agent-arbejde (Work Board canvas er pensioneret).

**Status-legend:** `[ ]` todo · `[~]` i gang · `[x]` færdig · `[-]` blokeret / venter på Jan

---

## 1. Tag-katalog & lignende sager (PR [#374](https://github.com/LarrySAIndersen/STARDESK/pull/374))

**Epic-status:** `[~]` draft, 4/10 commits, CI grøn  
**Branch:** `cursor/tag-katalog-lignende-sager-938f`

| # | Delopgave | Status |
|---|-----------|--------|
| 1.1 | Manuel QA: tag-autocomplete på sag opret/rediger | `[ ]` |
| 1.2 | Manuel QA: lignende-sager-panel på ticket detail | `[ ]` |
| 1.3 | Verificér intake-assist tag-forslag (confidence + source) | `[ ]` |
| 1.4 | Kør `bash scripts/run-deliverable-gate.sh --full` på branch | `[ ]` |
| 1.5 | Beslut batch: 6 ekstra commits *eller* label `batch-ready` | `[ ]` |
| 1.6 | Markér PR **Ready for review** → auto-merge til `staging` | `[ ]` |

---

## 2. Staging auth & login (preview-miljø)

**Epic-status:** `[x]` merged til `staging` (PR #376–#390)  
**Opfølgning:**

| # | Delopgave | Status |
|---|-----------|--------|
| 2.1 | Verificér staging preview login (`sf01@example.dk`) efter #390 | `[ ]` |
| 2.2 | Verificér impersonate BFF mod staging API (#384) | `[ ]` |
| 2.3 | Gennemgå 401-checklist i PR #390 — opdater hvis nye edge cases | `[ ]` |
| 2.4 | Portal bruger-login: smoke test kundeportal på staging | `[ ]` |

---

## 3. Prod-release (`staging` → `main`)

**Epic-status:** `[-]` venter på Jan — **44 commits** på `staging` som ikke er på `main`

| # | Delopgave | Ansvar |
|---|-----------|--------|
| 3.1 | Gennemgå ændringsliste (auth-batch, tags, impersonate, m.fl.) | Jan |
| 3.2 | Kør staging preview + `run-deliverable-gate.sh --full` mod staging URLs | Agent/Jan |
| 3.3 | Opret release-PR `staging` → `main` | Jan |
| 3.4 | Merge release-PR og verificér Vercel prod deploy | Jan |
| 3.5 | Kør prod hello-world gate (`reports/prod-hello-world-gate-latest.md`) | Agent |
| 3.6 | Opdatér Sonar-dashboard på prod-gren efter merge | Agent |

---

## 4. Dependabot (dependency-bumps)

**Epic-status:** `[ ]` 7 åbne PRs (#385–#392)

| # | Delopgave | PR |
|---|-----------|-----|
| 4.1 | Review + merge `python-multipart` 0.0.29 → 0.0.31 | [#385](https://github.com/LarrySAIndersen/STARDESK/pull/385) |
| 4.2 | Review + merge `starlette` 1.2.1 → 1.3.1 | [#386](https://github.com/LarrySAIndersen/STARDESK/pull/386) |
| 4.3 | Review + merge `js-yaml` (project-kanban) | [#387](https://github.com/LarrySAIndersen/STARDESK/pull/387) |
| 4.4 | Review + merge `hono` 4.12.23 → 4.12.25 | [#388](https://github.com/LarrySAIndersen/STARDESK/pull/388) |
| 4.5 | Review + merge `js-yaml` (web) | [#389](https://github.com/LarrySAIndersen/STARDESK/pull/389) |
| 4.6 | Review + merge `pydantic-settings` 2.14.1 → 2.14.2 | [#391](https://github.com/LarrySAIndersen/STARDESK/pull/391) |
| 4.7 | Review + merge `@cyclonedx/cyclonedx-npm` 4.2.1 → 5.0.0 | [#392](https://github.com/LarrySAIndersen/STARDESK/pull/392) |

---

## 5. Constitution — kodepraksis

**Epic-status:** `[~]` #39 partial, #40 done — næste: **#43**  
Se [STARDESK-kodepraksis-50-plan.md](./constitution/STARDESK-kodepraksis-50-plan.md)

| # | Delopgave | Status |
|---|-----------|--------|
| 5.1 | **#39 fase 2:** Ruff C90, S, D (782 hits) — batch-fix eller defer per fil | `[ ]` |
| 5.2 | **#43:** Pin Python deps (`uv export --frozen` → requirements.txt) | `[ ]` |
| 5.3 | **#44:** Dependabot/Renovate audit (overlapper epic 4) | `[ ]` |
| 5.4 | **#50:** `make check` target (ruff + eslint + tsc + pytest) | `[ ]` |

---

## 6. Constitution — testdækning (coverage agent)

**Epic-status:** `[ ]` Batch 15 planlagt (~83 % API)

| # | Delopgave | Mål |
|---|-----------|-----|
| 6.1 | `gmail.py` webhook/sync flows | 51 % → 70 %+ |
| 6.2 | `gmail.py` inbound ticket creation path | tests |
| 6.3 | `tickets.py` router — udvalgte endpoints | 55 %+ |
| 6.4 | `slack.py` resterende branches | 90 % → 95 % |
| 6.5 | Deliverable gate + PR batch mod `staging` | gate |

---

## 7. Sagsarkiv & produktion (før go-live)

**Epic-status:** `[ ]` spec klar — [sagsarkiv-produktion.md](./sagsarkiv-produktion.md)

| # | Delopgave | Status |
|---|-----------|--------|
| 7.1 | ADR/spec: opbevaringspolitik (GDPR, sletning CPR) | `[ ]` |
| 7.2 | Design: fuld sag-eksport JSON-pakke (ikke kun Excel-oversigt) | `[ ]` |
| 7.3 | Implementér periodisk eksport-job (lukkede sager) | `[ ]` |
| 7.4 | Vedhæftninger → durable blob storage (ikke kun lokal disk) | `[ ]` |
| 7.5 | Verificér StatusTimeline på alle ruter (staff, portal, classic) | `[ ]` |
| 7.6 | Eksport-format til eksternt system (ServiceNow m.fl.) | `[ ]` |

---

## 8. Dev-miljø & gate (infrastruktur)

**Epic-status:** `[~]` løbende

| # | Delopgave | Status |
|---|-----------|--------|
| 8.1 | Neon `test`-branch: `sync-neon-env.sh` + bootstrap | `[ ]` |
| 8.2 | Verificér PR #137 (Vercel bypass i staging gate) — allerede på staging? | `[ ]` |
| 8.3 | Dokumentér staging preview URLs + bypass-token flow | `[ ]` |
| 8.4 | Cursor Peacock/farver per repo (STARDESK blå, STARDOC grøn) — editor only | `[ ]` |

---

## 9. Sonar security

**Epic-status:** `[x]` 0 åbne security issues (rapport 2026-06-01)  
**Opfølgning:** ingen aktiv `cursor/sonar-remediation-loop` PR — genstart loop ved nye findings.

| # | Delopgave | Status |
|---|-----------|--------|
| 9.1 | Kør frisk Sonar-scan (`npm run sonar:pipeline` i `scripts/`) | `[ ]` |
| 9.2 | Ved nye issues: ét commit per tick på sonar-loop-gren | `[ ]` |

---

## Prioriteret rækkefølge (anbefaling)

1. **Epic 1** — afslut tag-PR (#374)  
2. **Epic 2** — staging smoke efter auth-batch  
3. **Epic 3** — prod-release (Jan)  
4. **Epic 4** — dependabot i små batches  
5. **Epic 5–6** — constitution ticks  
6. **Epic 7** — sagsarkiv (langsigt, før go-live)

---

## Reference

| Emne | Fil |
|------|-----|
| Dev/gate cheatsheet | [huskeliste.md](./huskeliste.md) |
| Constitution | [constitution/README.md](./constitution/README.md) |
| Staging batch-policy | [../docs/staging-batch-policy.md](../docs/staging-batch-policy.md) |
