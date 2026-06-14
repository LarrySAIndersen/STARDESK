# STARDESK — Udviklingsparadigme

> **Formål:** Fælles metode for hvordan STARDESK forbedres — menneske + AI, målt og prioriteret.
> **Constitution:** Tre 50-punkts planer + dette paradigme. Se [README](./README.md).

---

## 0. Grundlov: Spørg ved tvivl (agent-afklaring)

**Før alt andet** gælder [STARDESK-agent-afklaring.md](./STARDESK-agent-afklaring.md):

- Agenten **stopper og spørger** når intent, scope, kvalitet eller drift er uklart
- Pågående arbejde (åben PR, batch) afklares eksplicit — agenten gætter ikke om det skal med
- Op til **20 nummererede spørgsmål** fra katalog A–E (scope, kvalitet, drift, sikkerhed, performance)
- **Ingen kode** før afklaring — medmindre opgaven er entydig eller brugeren siger "bare gør det"

```text
Afklar tvivl → Forstå → Debattér → Godkend → Implementér → Mål → Lever (PR + gate)
```

---

## 1. Kerneidé: Debate-first, mål-først, lever-i-små-PR'er

STARDESK forbedres ikke ved at "fixe alt på listen". Hvert punkt går gennem:

```text
Forstå → Debattér → Godkend → Implementér → Mål → Lever (PR + gate)
```

(For constitution-punkter kommer **afklaring** før "Forstå" — se §0.)

| Fase | Spørgsmål | Output |
|------|-----------|--------|
| **Forstå** | Er punktet relevant i vores kontekst (Vercel, Neon test, ITSM)? | Ja / nej / delvist |
| **Debattér** | Angrebsvektor, flaskehals, tradeoff, effort vs. impact | Anbefalingstabel |
| **Godkend** | Jan / product owner siger go | Eksplicit ja |
| **Implementér** | Minimal korrekt diff, eksisterende konventioner | Feature-gren + commits |
| **Mål** | Gate, tests, evt. perf/sonar baseline | Bevis i rapport |
| **Lever** | Draft PR mod `staging`, auto-merge ved grøn CI | PR-URL |

**Principper:**

- **Sikkerhed:** Forstå trusselsbilledet — ikke "slå alt til".
- **Performance:** Mål før fix — gætteri er forbudt.
- **Kodepraksis:** Refaktorér inkrementelt — ikke omskriv hele tickets.py i én PR.

---

## 2. Constitution — tre søjler

| Søjle | Dokument | Fokus | Start her |
|-------|----------|-------|-----------|
| **Sikkerhed** | [STARDESK-sikkerhed-50.md](./STARDESK-sikkerhed-50.md) | Auth, uploads, CORS, SQL, secrets | KRITISK 1–10 |
| **Performance** | [STARDESK-performance-50.md](./STARDESK-performance-50.md) | N+1, pool, cache, frontend load | KRITISK 1–10 + baseline |
| **Kodepraksis** | [STARDESK-kodepraksis-50.md](./STARDESK-kodepraksis-50.md) | Typing, DRY, SRP, test, lint | Scorecard + plan #39→ |

**Prioritet mellem søjler** (typisk rækkefølge):

1. **Sikkerhed KRITISK** — reel eksponering (auth, uploads, secrets)
2. **Performance KRITISK** — målt flaskehals (N+1, pool exhaustion)
3. **Kodepraksis lint/enforcement** — gør resten billigere (#39–#44)
4. **Kodepraksis struktur** — DRY, SRP, test (løbende)

---

## 3. Agent-loops (automatiseret eksekvering)

Hver søjle kan køres **ét punkt ad gangen** med queue + rapport.

### Kodepraksis

```bash
cd scripts
npm run kodepraksis:init
npm run kodepraksis:tick          # → reports/kodepraksis-agent-latest.md
npm run kodepraksis:result -- --n 39 --status done --pr "<url>"
```

- Plan: [STARDESK-kodepraksis-50-plan.md](./STARDESK-kodepraksis-50-plan.md)
- Fallback: primær → partial → defer → wontfix
- Skill: `.cursor/skills/stardesk-kodepraksis-agent/SKILL.md`

### Performance (mål før optimering)

```bash
bash scripts/sync-neon-env.sh
bash scripts/setup-dev-environment.sh
bash scripts/dev-up.sh
cd scripts && npm run perf:pipeline
```

- Constitution: [STARDESK-performance-50.md](./STARDESK-performance-50.md)
- Rapporter: `reports/performance-prerequisites-latest.md`, `reports/performance-evidence-latest.md`
- Skill: `.cursor/skills/stardesk-performance-agent/SKILL.md`
- **Regel:** Implementér KRITISK 1–10 kun når baseline viser reel cost.

### Sikkerhed

- Constitution: [STARDESK-sikkerhed-50.md](./STARDESK-sikkerhed-50.md)
- Overlap: Sonar security loop (`.cursor/skills/stardesk-sonar-agent/SKILL.md`)
- **Regel:** Debattér angrebsvektor før hvert KRITISK punkt — ingen "best practice theatre".

### Sonar (sikkerhed + code smells)

- Auto-merge loop er **undtagelse** — kun smalle Sonar-fixes
- Alt andet: normal PR-only flow mod `staging`

---

## 4. Git & release (obligatorisk)

```text
cursor/<beskrivelse>-9a30  →  PR (base: staging)  →  auto-merge  →  [Jan] staging → main
```

| Tilladt | Forbudt |
|---------|---------|
| Branch fra `staging`, push feature-gren | `git push origin main` / `staging` |
| Draft PR mod **`staging`** | Feature-PR direkte mod `main` |
| Afslut med **PR-URL** | "Committed to main" |

Se: `docs/pr-only-period.md`, `docs/release-process.md`

---

## 5. Deliverable gate (før "færdig")

```bash
bash scripts/run-deliverable-gate.sh          # altid
bash scripts/run-deliverable-gate.sh --full   # UI / auth / routing
```

- Login: Anna `sf01@example.dk` / `Stardesk2026!`
- `/health`: `stardesk_env` ≠ `production`
- **Ingen opgave er færdig uden PASSED gate** (medmindre ren docs uden runtime-effekt — så stadig basis-gate).

---

## 6. Anbefalingstabel (skabelon)

Bruges før implementering af ethvert constitution-punkt:

| # | Punkt | Relevant? | Evidens | Løsning | Effort | Risk | Anbefaling |
|---|-------|-----------|---------|---------|--------|------|------------|
| 1 | … | Ja/Nej/Delvist | grep, p95, Sonar | … | S/M/L | Lav/Høj | Implementér / Benchmark / Udskyd / Afvis |

**Godkendelse kræves** før kode for sikkerhed KRITISK og performance KRITISK.

---

## 7. Typisk uge (eksempel)

| Dag | Aktivitet |
|-----|-----------|
| Man | `kodepraksis:tick` — ét lint/typing-punkt |
| Tir | Performance baseline hvis optimering planlagt |
| Ons | Feature-arbejde (bruger-story) + gate |
| Tor | Sikkerhed-debat: 2–3 KRITISK-punkter → tabel til godkendelse |
| Fre | Review åbne PR'er, opdatér queue-status |

---

## 8. Hvad vi beskytter (scorecard 7/10)

Fra [kodepraksis-50](./STARDESK-kodepraksis-50.md) — **behold disse styrker:**

- Ren kodehygiejne (0 TODO/FIXME-rode)
- Services-lag med typing og docstrings
- TypeScript `strict: true`
- Pydantic Settings + env-validation
- Arkitekturdokumentation (ARCHITECTURE.md, AGENTS.md)

Forbedringer må **ikke** ødelægge dette fundament.

---

## 9. Næste skridt

1. Vælg søjle (sikkerhed / performance / kodepraksis)
2. Læs constitution-dokumentet for søjlen
3. Kør relevant agent eller debattér KRITISK 1–10 manuelt
4. Præsentér anbefalingstabel → godkendelse
5. Implementér på `cursor/*-9a30` → PR mod `staging` → gate

**Performance lige nu:** Se `reports/performance-prerequisites-latest.md` — JMeter + fuld user-pool skal være grøn før `perf:pipeline` er READY.
