# Copy-paste: Cursor-agent for ny Work Board-opgave

Erstat `NN` med opgavenummer og `TITEL` med kort titel.

```text
STARDESK opgave #NN: TITEL

Git/release (obligatorisk):
- Checkout staging og pull seneste.
- Opret gren: cursor/opgave-NN-kort-slug fra staging.
- Arbejd kun på den gren.
- Opret draft PR med base staging (ALDRIG main).
- Når CI er grøn, må auto-merge til staging ske — merge IKKE til main.
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
