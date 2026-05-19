# Afhængigheder & sikkerhed (dependency audit)

Admin-panelet **Afhængigheder & sikkerhed** (`/admin/dependencies`) viser forældede pakker, CVE-poster og CVSS-score for monorepo-modulerne.

## Adgang

Kun brugere med rollen **admin** eller **top_admin**.

## Kør audit lokalt

Fra `scripts/`:

```bash
npm run security:audit
```

Dette kører `scripts/security-audit/run-audit.mjs`, som:

- `npm outdated --json` og `npm audit --json` i `apps/web` og `scripts` (hvis `package.json` findes)
- `pip audit --format json` eller `uv pip audit` i `apps/api` (hvis tilgængeligt)

Rapporten skrives til `reports/dependency-audit-latest.json` (gitignored).

## API

| Metode | Sti | Beskrivelse |
|--------|-----|-------------|
| `GET` | `/api/v1/admin/dependency-audit` | Returnerer cache (max 1 time) eller eksempeldata |
| `POST` | `/api/v1/admin/dependency-audit` | Kører audit-script og returnerer opdateret rapport |

Next.js-route i `apps/web` — kræver admin-session (JWT-cookie).

## Produktion

- Audit køres **ikke** automatisk ved hver sidevisning.
- Brug **Kør kontrol nu** i UI eller planlæg `npm run security:audit` i CI/cron.
- Commit aldrig `reports/dependency-audit-*.json`.

## CVSS-farver i UI

| CVSS | Badge |
|------|--------|
| ≥ 9 | Kritisk (rød) |
| 7 – 8.9 | Høj (orange) |
| 4 – 6.9 | Medium (gul) |
| &lt; 4 | Lav (blå) |
