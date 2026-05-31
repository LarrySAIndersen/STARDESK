# Copy-paste: Cursor-agent for ny Work Board-opgave

> **Pensioneret (2026-05):** Work Board / kanban agent-pipeline virker ikke — **brug ikke** denne prompt. Agenter arbejder direkte fra brugerens anmodning i chat og åbner PR mod `staging`. Filen beholdes kun som historik.

**Proces-diagram:** [proces-visuelt.md](./proces-visuelt.md)

**På board-kort:** `PR → staging | prod: manuel release` — se også bund af proces-visuelt.md.

Erstat `NN` med opgavenummer og `TITEL` med kort titel.

```text
STARDESK opgave #NN: TITEL

PR-ONLY (obligatorisk — docs/pr-only-period.md):
- Push ALDRIG til main eller staging.
- Checkout staging, pull, opret gren cursor/opgave-NN-kort-slug.
- Push kun feature-gren; opret draft PR base staging (ALDRIG main).
- Når CI grøn: auto-merge til staging — merge IKKE til main.
- Ved afslutning: kør bash scripts/run-deliverable-gate.sh (og --full ved UI).
- Skriv i PR: Deliverable gate: PASSED + output.
- Prod: Jan merger senere staging → main manuelt — gør det ikke for mig.

Work Board:
- Opdater opgaven med PR-link når PR er oprettet.
- Flyt ikke til Human Review før gate er grøn og PR er merged til staging.

Leverance:
[Beskriv hvad der skal laves — 3–5 punkter]
```

## Efter agenten er færdig (dig)

1. GitHub → PR med base **staging** — tjek at den er merged (eller merge selv hvis auto-merge fejlede).
2. Test på **Vercel Preview**-URL.
3. Når du vil have prod: **ny PR** `staging` → `main` og merge selv.

Se [release-process.md](./release-process.md).
