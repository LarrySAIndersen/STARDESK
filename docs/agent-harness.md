# STARDESK agent harness

Guide til at få Cursor-agenten (lokal **og** Cloud Agent) til at opføre sig korrekt.

## Hvad er harnesset?

Et **harness** er den samlede ramme der styrer agenten — ikke én fil, men lag der arbejder sammen:

| Lag | Placering | Formål |
|-----|-----------|--------|
| **Grundlov** | `workboard/constitution/STARDESK-agent-afklaring.md` | Stop ved tvivl; opt-out i chat |
| **Cursor rules** | `.cursor/rules/*.mdc` | Altid-gældende regler (PR-only, gate, proces) |
| **Skills** | `.cursor/skills/stardesk-*/SKILL.md` | Procedurer (gate, Sonar, kodepraksis, …) |
| **AGENTS.md** | repo root | Cloud Agent VM: Neon, scripts, verify |
| **Scripts** | `scripts/*.sh` | Setup, gate, bootstrap — maskinelt håndhævet |
| **Denne guide** | `docs/agent-harness.md` | Overblik + lokal workspace-opsætning |

## To miljøer — forstå forskellen

| | Din PC (Cursor desktop) | Cloud Agent VM |
|--|-------------------------|----------------|
| **Workspace** | `STARDESK CURSOR/` med flere mapper | Kun **ét Git-repo** (`star-itsm-cloud`) |
| **localhost** | Din egen maskine | VM'en i skyen — **ikke** din browser |
| **Secrets** | Lokale `.env` (gitignored) | Cursor **Cloud Agent secrets** |
| **Deploy/test i browser** | Vercel Preview / prod | Gate på VM; Preview med `--staging` |

Agenten skal **aldrig** antage at `Golden set`, `star-docs-portal` eller genveje på din PC findes i Cloud Agent — medmindre de er i Git eller eksplicit kopieret ind.

## Lokal workspace (Windows) — anbefalet opsætning

Din mappe `STARDESK CURSOR` med flere projekter er **ikke** det samme som Cloud Agent. Gør dette én gang:

### 1. Workspace-fil

Kopiér skabelonen til din workspace-rod:

```text
docs/templates/local-workspace/STARDESK-Cursor.code-workspace.example
  → STARDESK CURSOR/STARDESK-Cursor.code-workspace
```

Åbn **File → Open Workspace from File** og vælg den fil — ikke kun en enkelt undermappe.

### 2. Workspace-regel (over alle mapper)

```text
docs/templates/local-workspace/cursor-rules/stardesk-workspace-root.mdc
  → STARDESK CURSOR/.cursor/rules/stardesk-workspace-root.mdc
```

Den fortæller agenten hvilken mappe der er **hoved-app** (`STARDESK`) vs. reference/docs.

### 3. Primært repo

Sørg for at `STARDESK/` er en git-klon af `star-itsm-cloud` (GitHub: `LarrySAIndersen/STARDESK`).  
Repoets `.cursor/rules` og `AGENTS.md` gælder **inde i den mappe**.

### 4. Lokale env-filer (kun på din PC)

```powershell
cd STARDESK
bash scripts/sync-neon-env.sh      # hvis DATABASE_URL er sat i miljøet
bash scripts/setup-dev-environment.sh
bash scripts/dev-up.sh
```

På Windows kan du også bruge `scripts/dev-up.ps1` og `scripts/run-deliverable-gate.ps1`.

## Cloud Agent — secrets og setup

I **Cursor → Cloud Agent → Secrets** (minimum):

| Secret | Formål |
|--------|--------|
| `DATABASE_URL` | Neon **test** branch (`postgresql+asyncpg://…`) |
| `SONAR_TOKEN` | Valgfrit — Sonar-loop og live scan |

Efter secrets er sat på VM:

```bash
bash scripts/sync-neon-env.sh
bash scripts/sync-sonar-env.sh    # hvis SONAR_TOKEN findes
bash scripts/setup-dev-environment.sh
```

**Kendt gotcha:** Første gang på en frisk VM — hvis `uv sync --no-build` fejler:

```bash
cd apps/api && uv sync --group dev
```

Derefter `bash scripts/bootstrap-dev-database.sh --no-write-env` og `bash scripts/dev-up.sh`.

## Adfærdskontrakt (kort)

1. **Tvetydig opgave** → afklaring (se grundlov) — medmindre du skriver `opt-out afklaring` / `bare gør det`.
2. **Kodeændringer** → gren `cursor/…-7944` eller `opgave-…` → draft PR mod **`staging`** (aldrig direkte push til `staging`/`main`).
3. **Staging batch** → op til 10 commits før ready; prod kun Jan (`staging` → `main`).
4. **Færdig** → `bash scripts/run-deliverable-gate.sh` (`--full` ved UI) — skriv **Deliverable gate: PASSED** i summary.
5. **Schema** → ingen Alembic uden eksplicit godkendelse.
6. **Sikkerhed** → `.cursor/rules/00-security-invariants.mdc`.

## Skills — hvornår agenten skal læse dem

| Situation | Skill |
|-----------|--------|
| Før "done" / PR | `stardesk-deliverable-gate` |
| UI/portal review | `stardesk-portal-usability`, `stardesk-agent-review` |
| Sonar/security loop | `stardesk-sonar-agent`, `stardesk-sonar-review-loop` |
| Constitution kodepraksis | `stardesk-kodepraksis-agent` |
| Performance baseline | `stardesk-performance-load-test` |
| Anti-patterns audit | `stardesk-anti-patterns` |
| Efter merge staging | `stardesk-deploy-check` |

## Tjekliste — harness OK?

- [ ] Åbner `STARDESK-Cursor.code-workspace` (ikke kun undermappe)
- [ ] `STARDESK/.cursor/rules` findes (fra Git)
- [ ] Workspace-rod har `stardesk-workspace-root.mdc` (lokal kopi)
- [ ] `apps/api/.env` + `apps/web/.env.local` (gitignored, aldrig commit)
- [ ] Cloud Agent har `DATABASE_URL` (Neon test)
- [ ] Agent kender forskel på VM-localhost vs. Vercel Preview

## Relateret

- [AGENTS.md](../AGENTS.md) — Cloud Agent VM
- [deliverable-gate.md](./deliverable-gate.md)
- [pr-only-period.md](./pr-only-period.md)
- [environments.md](./environments.md)
- [STARDESK-agent-afklaring.md](../workboard/constitution/STARDESK-agent-afklaring.md)
