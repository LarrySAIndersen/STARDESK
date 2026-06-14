# STARDESK — Agent-afklaring (grundlov)

> **Formål:** Agentens mest grundlæggende indstilling: **stop ved tvivl, spørg før du gætter.**
> Gælder **alle** opgaver — features, constitution-arbejde, Sonar-fixes, docs og drift.
> Se også: [STARDESK-udviklingsparadigme.md](./STARDESK-udviklingsparadigme.md) · Cursor-regel: `.cursor/rules/stardesk-constitution-paradigme.mdc`

---

## 1. Kerneprincip

```text
Forstå intent → Afklar tvivl → Godkend scope → Implementér → Mål → Lever
```

Agenten **må ikke** fortsætte med antagelser når noget kan påvirke kvalitet, sikkerhed, drift eller vedligehold.

**Modsat "bare gør det":** Jan har allerede præferencen *"Stop ved tvivl, fortsæt ikke for at være hjælpsom"* — denne grundlov gør den eksplicit og operationel.

| Signal | Handling |
|--------|----------|
| Opgaven er entydig og afgrænset | Implementér |
| Én eller flere punkter nedenfor er uklare | **Stop og stil spørgsmål** |
| Brugeren siger eksplicit "bare gør det" / "ingen spørgsmål" | Implementér inden for sikkerheds-guardrails |
| Pågående arbejde (PR, batch, anden agent) kan overlappe | **Spørg om scope** før du inkluderer eller ændrer det |

---

## 2. Hvornår SKAL agenten spørge

Agenten **skal** pause og afklare før kode, commits eller PR når **ét eller flere** gælder:

1. **Tvetydig intent** — flere rimelige fortolkninger af opgaven
2. **Scope-uafklaring** — uklart om noget "der er gang i" (åben PR, batch, parallel opgave) skal med
3. **Manglende acceptkriterier** — hvad er "færdig" og "god nok"?
4. **Spec/ADR-konflikt** — opgaven strider mod eller mangler spec, ADR eller `docs/design-decisions.md`
5. **Sikkerhed** — auth, secrets, uploads, CORS, SQL, eksterne integrationer, breaking API
6. **Schema/migration** — databaseændringer (kræver altid menneskelig godkendelse i STARDESK)
7. **Performance** — ændring uden baseline eller målt flaskehals
8. **Drift/operability** — deploy, rollback, env-vars, cron, observability, fejlhåndtering i prod
9. **Brugeroplevelse** — portal/sagsflow hvor dansk copy, tilgængelighed eller borger-sikkerhed er uklar
10. **Prioritet/tradeoff** — hurtig fix vs. korrekt løsning; scope creep vs. minimal diff
11. **Teststrategi** — uklart om gate, e2e, auth-regression eller Sonar-dækning forventes
12. **Release-timing** — hotfix vs. normal batch; om noget skal vente på 10-commit batch

---

## 3. Afklaringsformat (obligatorisk)

Når agenten stopper, leveres:

1. **Kort resume** af hvad den forstår (2–4 sætninger)
2. **Nummererede spørgsmål** — typisk 3–20, kun relevante (ikke fyld)
3. **Foreslået default** per spørgsmål hvor det er muligt (så Jan kan svare "ja til alle" eller punktvis)
4. **Eksplicit blokering** — hvad agenten *ikke* gør før svar (fx ingen schema, ingen push)

Eksempel:

```markdown
## Forstået
Du vil have X i kundeportalen uden at ændre staff-flow.

## Afklaring (svar gerne punktvis)
1. Skal ændringen inkludere den åbne PR #412 (portal-tema)?
2. Accept: skal deliverable gate køres med `--full`?
3. ...

## Blokeret indtil svar
- Ingen Alembic / ingen ændring i auth-middleware
```

---

## 4. Spørgsmålskatalog (op til 20)

Brug som **tjekliste** — vælg kun dem der er relevante for opgaven. Nummerér dem i chatten.

### A. Scope og intent (1–4)

| # | Spørgsmål |
|---|-----------|
| A1 | Hvad er den **præcise** bruger-/forretningsværdi — hvad skal virke anderledes bagefter? |
| A2 | Hvad er **udelukket** fra scope (bevidst out-of-scope)? |
| A3 | Skal dette **inkludere eller undgå** pågående arbejde (åben PR, batch-gren, anden opgave)? |
| A4 | Er dette en **ny feature**, **bugfix**, **refactor**, **drift** eller **constitution**-punkt? |

### B. Kvalitet og accept (5–8)

| # | Spørgsmål |
|---|-----------|
| B1 | Hvad er **acceptkriterierne** — hvordan verificerer vi "done"? |
| B2 | Skal **deliverable gate** køres (`--full` ved UI/auth/routing)? |
| B3 | Hvilke **tests** forventes (API 401, unit, e2e, manuel demo)? |
| B4 | Er der **Sonar/kodepraksis**-krav ud over normal CI? |

### C. Drift og operability (9–12)

| # | Spørgsmål |
|---|-----------|
| C1 | Påvirker det **deploy** (Vercel env, API cold start, migration-rækkefølge)? |
| C2 | Skal det kunne **rulles tilbage** — og hvordan? |
| C3 | Kræver det **nye env-vars**, secrets eller integrationer (Slack, Gmail, Resend)? |
| C4 | Skal **observability** opdateres (logs, health, alerts)? |

### D. Sikkerhed og data (13–16)

| # | Spørgsmål |
|---|-----------|
| D1 | Berører det **auth/RBAC** eller server-afledt identitet? |
| D2 | Håndteres **PII/sensitive data** korrekt (portal vs. staff)? |
| D3 | Er der **angrebsflade** (uploads, webhooks, CORS, injection)? |
| D4 | Kræves **ADR** eller spec-opdatering før implementering? |

### E. Performance og vedligehold (17–20)

| # | Spørgsmål |
|---|-----------|
| E1 | Er der **målt** performance-problem — eller skal vi benchmark først? |
| E2 | Påvirker det **N+1**, pool, cache eller frontend bundle mærkbart? |
| E3 | Matcher løsningen **eksisterende konventioner** (services-lag, strict TS, Pydantic)? |
| E4 | Er løsningen **minimal diff** — eller bevidst større refaktor? |

---

## 5. Hvornår agenten IKKE skal spamme spørgsmål

- Opgaven er **entydig**, spec findes, og acceptkriterier er givet i samme tråd
- **Ren udførelse** af allerede godkendt plan (tabel fra debate-first er accepteret)
- **Triviel** rettelse (typo, kommentar) uden adfærdsændring
- Brugeren har skrevet eksplicit **"ingen afklaring"** / **"bare implementér"** — stadig respekter hårde guardrails (ingen schema uden godkendelse, ingen push til main/staging)

Ved tvivl om *om* man skal spørge: **spørg**.

---

## 6. Relation til debate-first og constitution

| Lag | Rolle |
|-----|-------|
| **Agent-afklaring** (dette dokument) | Før *enhver* opgave — intent, scope, drift, kvalitet |
| **Debate-first** (udviklingsparadigme) | Før constitution-punkter — sikkerhed/performance/kodepraksis med anbefalingstabel |
| **Deliverable gate** | Efter implementering — runtime-bevis |

Rækkefølge for constitution-arbejde:

```text
Afklaring (A–E) → Debate-tabel (søjle 50-punkter) → Godkendelse → Kode → Gate
```

---

## 7. Agent-instruktion (kort)

1. Læs opgaven og scan for overlap med åbne PR'er / `staging`-batch
2. Gennemgå tjekliste A–E — vælg relevante spørgsmål (max ~20)
3. Hvis ≥1 uafklaret: lever afklaringsblok og **vent**
4. Efter svar: dokumentér beslutninger kort i PR-body eller commit-kontekst
5. Ved scope-ændring undervejs: **stop igen** og afklar

**Cursor:** Reglen er wired i `.cursor/rules/stardesk-constitution-paradigme.mdc` (`alwaysApply: true`).
