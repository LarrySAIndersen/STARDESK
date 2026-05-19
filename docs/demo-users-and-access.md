# Testbrugere, grupper og adgang

**Genskabelse i DB:** `docs/seed-sf-ecosystem-reset.sql`  
**Eksterne leverandører (KMD, Netcompany, Schultz):** `docs/seed-vendor-groups-kmd-netcompany-schultz.sql`  
**Migration (delt sag + roller):** `docs/ticket-shared-migration.sql`  
**Login-UI:** `apps/web/src/lib/demo-users.ts` (skal matche seed)

## Rettighedsgrupper (ikke det samme som dispatch-grupper)

| Rettighedsgruppe | DB `role` | Sager | Konfiguration / brugere | Excel-export |
|------------------|-----------|-------|-------------------------|--------------|
| Topadministrator | `top_admin` | Alle | Ja (fuld) | Ja |
| Administrator | `admin` | Alle | Ja | Ja |
| Agent | `agent` | Egen org / dispatch-board | Nej | Ja (egne scope) |
| Slutbruger | `end_user` | Egen org + delte + store sager | Nej | Nej |

## Slutbruger-synlighed

- Sager i **egen organisation** (`organization_id`)
- **Delte sager** (`is_shared = true`) — også fra andre org
- **Store sager** (`is_major`) — særskilt kolonnevisning i portalen
- Egne indmeldte sager uden org-tilknytning

Implementering: `apps/api/src/star_itsm_api/services/org_access.py`, `services/permissions.py`

## Adgangskoder

| Brugergruppe | Adgangskode |
|--------------|-------------|
| Alle `@example.dk` i seed (undtagen nedenfor) | `Stardesk2026!` |
| `larrysanders@example.dk` | `password` (ikke på login-listen) |

## Aktive testbrugere (login-UI)

### Self-service

| E-mail | Navn |
|--------|------|
| submitter@example.dk | Anders Submitter |

### SF administratorer (alle sager)

| E-mail | Navn | Rolle |
|--------|------|-------|
| sf01@example.dk | Anna | `top_admin` |
| sf02@example.dk | Bo | `admin` |
| sf03@example.dk | Clara | `admin` |

### Virksomheds-agenter (3 pr. org)

| Organisation | E-mails |
|--------------|---------|
| Virksomhed | estrifft01@ – estrifft03@example.dk |
| North Star | northstar01@ – northstar03@example.dk |
| Jobflow | jobflow01@ – jobflow03@example.dk (intern) |
| Sirius | sirius01@ – sirius03@example.dk |
| BI | bi01@ – bi03@example.dk |
| SF Operations | sfchest01@ – sfchest03@example.dk |

### Eksterne leverandører (3 pr. org)

| Organisation | E-mails |
|--------------|---------|
| KMD | kmd01@ – kmd03@example.dk |
| Netcompany | netcompany01@ – netcompany03@example.dk |
| Schultz | schultz01@ – schultz03@example.dk |

Adgangskode for alle ovenstående: `Stardesk2026!` (se også seed-filens kommentar).

## Grupper (teams) — dispatch

| Gruppenavn | Organisation | Formål |
|------------|--------------|--------|
| SF | (ingen) | Hovedgruppe — 6 medlemmer (Larry, Anna, Bo, Clara, Operations agent 1–2) |
| Virksomhed | Virksomhed | Lokal gruppe |
| North Star | North Star | Lokal gruppe |
| SF Operations | SF Operations | Lokal gruppe (agent 3 kun her, ikke i SF) |
| SF AI Operations | SF AI Operations | Fælles AI-drift |
| Jobflow | Jobflow | Intern lokal gruppe |
| Sirius | Sirius | Lokal gruppe |
| BI | BI | Lokal gruppe |
| KMD | KMD | Ekstern leverandør |
| Netcompany | Netcompany | Ekstern leverandør |
| Schultz | Schultz | Ekstern leverandør |

**Fjernet:** SF Koncern / `sfkoncern01–03@example.dk` (se `seed-vendor-groups-kmd-netcompany-schultz.sql`).

UI-klassificering intern/ekstern: `apps/web/src/lib/team-categories.ts` (ikke DB-felt).

## Excel-export

- **API:** `GET /api/v1/reports/tickets/export` → `.xlsx`
- **UI:** Rapporter-siden — knap «Eksporter til Excel»
- Kolonner: sagsnr., titel, organisation, status, prioritet, type, sagsbehandler, gruppe, indmelder, stor/delt sag, datoer

## Adgangslogik (fejlsøgning)

```
top_admin / admin → alt
agent + organization_id → tickets WHERE organization_id = brugerens org
agent uden organization_id → dispatch: team-scope; central desk ser bredt
end_user → org OR is_shared OR egne reporter_sager; store sager via ?store_sager=true
```

Ved **403 på sag-detalje**: tjek org, `is_shared`, eller rolle.

Ved **tom board**: tjek `?board=true` og at bruger er staff (`agent`, `admin`, `top_admin`).

## Miljø for login-oversigt

Vercel (web): `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` — ellers kun manuelt login-felt.
