# Gmail integration i STARdesk

STARdesk kan oprette sager fra indgående Gmail og sende svar i samme tråd med sagsnummer i emne og brødtekst.

**Anbefalet postkasse:** `proto.star.itsm@gmail.com` (visningsnavn: *STAR Service Desk / STARdesk*).

> **Sikkerhed:** Brug **Google Cloud OAuth** (anbefalet). Gem aldrig Gmail-adgangskoder i git, `.env.example` eller dokumentation. Sæt hemmeligheder kun i lokal `.env.local` / Vercel Environment Variables. Hvis en adgangskode er delt i chat eller mail, **rotér den** i Google-kontoen med det samme.

## 1) Google Cloud Console

1. Opret et projekt i [Google Cloud Console](https://console.cloud.google.com/).
2. Aktiver **Gmail API** for projektet.
3. Gå til **APIs & Services → OAuth consent screen**:
   - Vælg app-type (External til test, Internal hvis Workspace).
   - Udfyld app-navn, support-e-mail og udvikler-e-mail.
   - Tilføj testbrugere hvis appen er i *Testing* (inkl. `proto.star.itsm@gmail.com`).
   - Tilføj scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
4. Gå til **Credentials → Create Credentials → OAuth client ID**:
   - Type: **Web application**
   - **Authorized redirect URIs** (begge skal være med):
     - Lokal: `http://localhost:3000/api/integrations/gmail/oauth/callback`
     - Produktion: `https://<dit-vercel-domæne>/api/integrations/gmail/oauth/callback`
5. Kopiér **Client ID** og **Client secret** til miljøvariabler (se nedenfor).

## 2) Forbind Gmail i STARdesk

1. Log ind i STARdesk som **admin**.
2. Åbn **Integrationer → Gmail** (`/integrations/gmail`).
3. Klik **Forbind med Gmail**.
4. I browseren: log ind med **`proto.star.itsm@gmail.com`** (ikke en anden Google-konto).
5. Godkend de anmodede Gmail-scopes.
6. Efter redirect: aktivér integrationen og kør **Test forbindelse**, derefter **Kør sync nu**.

Hvis `GMAIL_SYNC_FROM_EMAIL` er sat, afvises OAuth, hvis en anden konto forbindes.

## 3) Miljøvariabler

### Backend (Vercel api-projekt / lokal `apps/api/.env`)

| Variabel | Beskrivelse |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth Client ID fra Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth Client secret |
| `GMAIL_REDIRECT_URI` | Skal matche redirect URI i Google (fx `https://<domæne>/api/integrations/gmail/oauth/callback`) |
| `GMAIL_SYNC_FROM_EMAIL` | Forventet postkasse, fx `proto.star.itsm@gmail.com` |
| `GMAIL_DEFAULT_FROM` | Valgfri RFC5322 From ved udsendelse, fx `STAR Service Desk / STARdesk <proto.star.itsm@gmail.com>` |
| `GMAIL_MOCK` | `1` = fixture-mails uden Google (kun dev) |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | Fernet-nøgle til refresh tokens i produktion |
| `GMAIL_ALLOW_PLAINTEXT_TOKENS` | `1` kun lokalt; `0` i produktion |
| `JWT_SECRET` | Kræves til OAuth state |

### Frontend (Vercel)

OAuth-start/callback kører via Next.js BFF; backend-URL skal pege på API:

| Variabel | Beskrivelse |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL (Vercel api-projekt) |

Sæt **Google OAuth-variabler på backend-deployment** (ikke kun Vercel web), medmindre I proxyer dem eksplicit.

## 4) Database-migration (Neon)

Tabeller: `email_integrations`, `ticket_emails`.

**Automatisk:** API kører `apps/api/src/star_itsm_api/sql/migrations/20_email-integration.sql` ved opstart, hvis tabeller mangler.

**Manuelt i Neon SQL Editor:** kør hele scriptet i `apps/api/src/star_itsm_api/sql/migrations/20_email-integration.sql` (idempotent).

## 5) Kryptering af refresh tokens

**Produktion:**

- Generér Fernet-nøgle (fx `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
- Sæt `GMAIL_TOKEN_ENCRYPTION_KEY`.
- Sæt `GMAIL_ALLOW_PLAINTEXT_TOKENS=0`.

**Lokal udvikling:**

- `GMAIL_ALLOW_PLAINTEXT_TOKENS=1` er tilladt uden Fernet.

## 6) Funktionel adfærd

- **Inbound sync:** `POST /api/v1/integrations/gmail/sync` (admin)
  - Nye Gmail-tråde → nye tickets (`source=email`).
  - Eksisterende `gmail_thread_id` → besked på samme sag i `ticket_emails`.
  - Dubletter undgås via `gmail_message_id`.
- **Outbound svar:** `POST /api/v1/tickets/{id}/email-reply`
  - Sender i samme Gmail-tråd.
  - Emne: `Re: [INC-xxxx] …`
  - Footer: `Sagsnummer: INC-xxxx`
- **UI:** `/integrations/gmail`, e-mailtråd på sag (staff), **Svar på e-mail**.

## 7) Mock mode

`GMAIL_MOCK=1` uden forbindelse: sync og svar med fixture-data (ingen Google API).

## 8) Valgfri: App Password (kun lokal test)

OAuth er den understøttede vej. Gmail App Passwords bruges **ikke** af denne integration til API-kald. Hvis du kun vil teste manuel mail uden for STARdesk, kan du oprette en App Password i Google-kontoen — gem den **kun** i lokal `.env.local`, aldrig i repo.

## 9) Cron / planlagt sync

Planlæg periodisk `POST /api/v1/integrations/gmail/sync` med admin-token eller dedikeret cron-endpoint, når I er klar til automatisk indlæsning uden manuel knap.
