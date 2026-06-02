# STARDESK — 50-Punkt Sikkerhedsoptimering

> **Formål:** Prioriteret sikkerhedsplan for hele STARDESK-kodebasen.
> **Workflow:** Hvert punkt starter med at AI'en (dig) **debatterer forslaget**: er det relevant for STARDESK? Hvad er den bedste løsning i denne kontekst? Først derefter implementeres.
> **Prioritet:** KRITISK (1-10) → HØJ (11-25) → MEDIUM (26-40) → LAV (41-50)
> **Kontekst:** FastAPI + Next.js 15 + SQLAlchemy async + PostgreSQL, deployed on Vercel serverless

---

## INSTRUKTION TIL CURSOR

**Før du implementerer noget:**
1. Læs hele dette dokument
2. For hvert punkt: debattér med dig selv — er det faktisk en risiko i STARDESK? Hvad er den konkrete angrebsvektor? Hvad er tradeoffs?
3. Formulér din anbefaling (implementér / udskyd / afvis med begrundelse)
4. Præsentér din plan for mig **før** du skriver kode
5. Implementér kun efter min godkendelse

**Princip:** Sikkerhed handler ikke om at slå alt til — det handler om at forstå trusselsbilledet og vælge de rigtige kontroller for denne applikation.

---

## KRITISK (1-10) — Reel eksponeringsrisiko

### 1. Ingen rate limiting på auth-endpoints
**Fil:** `routers/auth.py`
**Problem:** Login-endpoint har ingen rate limiting. En angriber kan brute-force passwords uendeligt.
**Debat-spørgsmål:** Vercel har built-in DDoS protection — er det nok? Hvad med credential stuffing under tærsklen?
**Retning:** `slowapi` eller custom middleware med per-IP/per-user tæller. Redis-backed i produktion.

### 2. JWT HS256 med delt secret — ingen rotation
**Fil:** `core/security.py:22,87`
**Problem:** HS256 bruger én `jwt_secret` til signering OG verifikation. Ingen mekanisme til rotation. Compromise af secret = alle tokens gyldige for evigt.
**Debat-spørgsmål:** Er HS256 ok for denne applikation, eller bør det være RS256 (asymmetrisk)? Hvad er rotation-strategien?
**Retning:** Overvej RS256 med key-pair, eller HS256 med `jwt_secret_previous` for graceful rotation.

### 3. Token udløb: 12 timer, ingen refresh-token
**Fil:** `core/security.py:23`
**Problem:** Access token lever 12 timer. Ingen refresh-token mekanisme. Brugeren er logget ind i 12 timer uanset hvad — og der er ingen måde at tilbagekalde en kompromitteret token.
**Debat-spørgsmål:** Er 12 timer acceptable for en ITSM-platform med borgerdata? Hvad koster det at implementere refresh-tokens vs. token blacklist?
**Retning:** Kort-livet access token (15-30 min) + refresh token + token revocation liste.

### 4. Virus scan er placeholder — ingen reel scanning
**Fil:** `services/virus_scan.py:1`
**Problem:** Filen starter bogstaveligt med `"""Virus scan placeholder — replace with ClamAV / cloud scanner in production."""`. Blokerer kun filendelser (.exe, .bat osv.) men scanner ikke indholdet.
**Debat-spørgsmål:** Hvad er angrebsfladen? Bruges uploads kun internt, eller kan borgere uploade?
**Retning:** ClamAV (open source, self-hosted) eller cloud-baseret (VirusTotal API, Cloudflare R2 scanning).

### 5. Ingen filstørrelsesbegrænsning på uploads
**Fil:** `services/attachments.py`, `routers/tickets.py`
**Problem:** Ingen `max_size` check på UploadFile. En angriber kan uploade arbitrært store filer og udtømme serverens disk/RAM.
**Debat-spørgsmål:** Hvad er Vercel's filstørrelses-grænse? Beskytter den i sig selv?
**Retning:** Eksplicit `Content-Length` check + streaming upload med max bytes.

### 6. CORS: `allow_methods=["*"]`, `allow_headers=["*"]`
**Fil:** `main.py:74-75`
**Problem:** Bredest mulige CORS. `allow_headers=["*"]` med `allow_credentials=True` er en risiko — en ondsindet side kan sende vilkårlige headers.
**Debat-spørgsmål:** Hvilke metoder og headers bruges faktisk? Kan vi stramme til GET/POST/PUT/PATCH/DELETE + Authorization/Content-Type?
**Retning:** Eksplicit liste over tilladte metoder og headers.

### 7. Ingen CSRF-beskyttelse
**Fil:** Hele codebasen — 0 CSRF-referencer
**Problem:** Med `allow_credentials=True` og cookie-baserede sessioner (JWT i cookie?) kan cross-site requests udføre handlinger.
**Debat-spørgsmål:** Bruger STARDESK cookies til auth, eller kun Authorization-header? Hvis kun header → CSRF er ikke en risiko. Undersøg.
**Retning:** Hvis cookies bruges: SameSite=Strict + CSRF-token. Hvis kun Bearer header: dokumentér det som bevidst valg.

### 8. Hardcoded JWT secret i koden (development fallback)
**Fil:** `core/config.py:13`
**Problem:** `LOCAL_JWT_SECRET = "local-development-only-jwt-secret-do-not-use-in-production"` er hardcoded. Hvis `is_production` logic har en fejl, bruges denne secret i produktion.
**Debat-spørgsmål:** Er `is_production`-checket robust nok? Hvad sker der ved en misconfigured deploy?
**Retning:** Fjern fallback helt. Kræv `JWT_SECRET` altid — fejl hårdt ved manglende config.

### 9. Prototype password hash med deterministisk salt
**Fil:** `core/security.py:51-61`
**Problem:** `hash_prototype_password()` bruger hardcoded, deterministiske bcrypt salts. Ethvert password hashet med denne funktion har en forudsigelig hash.
**Debat-spørgsmål:** Bruges dette i produktion, eller kun til seeding? Hvis kun seed → er det ok, men verificér.
**Retning:** Sikr at funktionen ALDRIG kaldes i produktion. Tilføj runtime-guard.

### 10. 22 raw `text()` SQL-kald — SQL injection overflade
**Fil:** Diverse services
**Problem:** 22 steder bruges `text()` raw SQL. Selv med SQLAlchemy kan `text()` være sårbar hvis parametre interpoleres i stedet for bindes.
**Debat-spørgsmål:** Bruger alle 22 steder `:param` binding, eller er der f-string/format interpolation?
**Retning:** Audit alle 22 steder. Konvertér til ORM-queries hvor muligt.

---

## HØJ (11-25) — Bør handles indenfor 2-4 uger

### 11. Ingen password-policy enforcement
Genererede passwords er 12 chars, men bruger-valgte passwords har ingen minimumskrav (længde, kompleksitet).

### 12. Ingen account lockout efter fejlede login-forsøg
Login kan gentages uendeligt. Ingen lockout, ingen delay, ingen alert.

### 13. Dependency versions er floor-pinned (`>=`), ikke ceiling-pinned
`fastapi>=0.115.0` accepterer enhver fremtidig version. En breaking change eller sårbar version installeres automatisk.

### 14. Ingen Content Security Policy (CSP) header
Security headers inkluderer X-Frame-Options, HSTS osv., men ingen CSP. XSS-angreb i frontend er ubeskyttet.

### 15. Webhook secret verification — timing attack risiko
`verify_integration_secret()` bruger sandsynligvis `==` string comparison. Bør bruge `hmac.compare_digest()`.

### 16. Ingen audit logging af sikkerhedshændelser
Login, fejlede login, rolle-ændringer, admin-handlinger — intet logges struktureret til en audit trail.

### 17. Seed SQL-filer med passwords i `docs/`
`seed-larrysanders.sql` og lignende indeholder password-hashes i offentligt tilgængeligt repository.

### 18. Ingen session invalidation ved password-ændring
Når en bruger ændrer password, forbliver eksisterende JWT-tokens gyldige i op til 12 timer.

### 19. `expire_on_commit=False` i session factory
Objekter forbliver tilgængelige efter commit uden re-fetch. Kan give stale data i sikkerhedskritiske flows (rolle-ændringer).

### 20. Ingen HTTP-only / Secure flags dokumenteret for tokens
Hvis JWT sendes i cookies, mangler HttpOnly og Secure flags. Undersøg token-transport.

### 21. File storage path traversal risiko
`attachments.py` bruger `Path(upload.filename).name` — verificér at dette er tilstrækkeligt mod `../../etc/passwd` payloads.

### 22. Cron endpoint sikret med simpel secret i header
Cron bruger en delt secret i header. Ingen IP-whitelisting, ingen HMAC-signatur.

### 23. Ingen request body size limit på API-niveau
FastAPI har ingen default body size limit. Stort POST-body = memory exhaustion.

### 24. Manglende authorization check på `integration_org` router
Verificér at `routers/integration_org.py` kræver admin-rettigheder.

### 25. `allow_credentials=True` med dynamisk CORS origins
Regex-baseret origin matching + credentials = risiko for origin confusion.

---

## MEDIUM (26-40) — Planlæg over de næste 1-2 måneder

### 26. Ingen secrets rotation mekanisme (JWT, webhook, cron)
### 27. Ingen dependency vulnerability scanning (Dependabot/Snyk)
### 28. Ingen SBOM (Software Bill of Materials)
### 29. Docker images bruger ikke non-root user (verificér Dockerfile)
### 30. Ingen network policy i Kubernetes manifests
### 31. Alembic migrations kører ikke automatisk — risiko for schema drift
### 32. Ingen input sanitering af HTML i ticket body/comments (XSS i stored data)
### 33. Gmail OAuth tokens — opbevaring og rotation
### 34. Slack integration secrets — samme overvejelse
### 35. Ingen observability for sikkerhed (SIEM integration, security events)
### 36. `bcrypt.gensalt(rounds=12)` — er 12 rounds nok i 2026?
### 37. Ingen API versioning deprecation strategy
### 38. Workboard workflow guard — race condition risiko
### 39. Ticket privacy service — verificér at IDOR er umuligt
### 40. Knowledge article access control — er det org-scopet korrekt?

---

## LAV (41-50) — Løbende forbedring

### 41. Tilføj `Permissions-Policy` for alle kendte features (not just camera/mic/geo)
### 42. Tilføj `X-DNS-Prefetch-Control: off` header
### 43. Tilføj `Cross-Origin-Opener-Policy` header
### 44. Tilføj `Cross-Origin-Resource-Policy` header
### 45. Implementér subresource integrity (SRI) for CDN-assets i frontend
### 46. Tilføj security.txt (/.well-known/security.txt)
### 47. Dokumentér threat model for STARDESK
### 48. Pen-test plan: definer scope og kadence
### 49. Incident response runbook for kompromitteret JWT secret
### 50. Sikkerhedsbevidsthedstræning for udviklere (OWASP Top 10 workshop)

---

## Næste skridt

Cursor: start med at debattere punkt **1-10** (KRITISK). For hvert:
1. Er det faktisk en risiko i STARDESKs kontekst?
2. Hvad er den præcise angrebsvektor?
3. Hvad er den bedste løsning givet stakken (FastAPI + Vercel + Neon)?
4. Hvad er effort vs. impact?

Præsentér dine konklusioner som en tabel, og vent på godkendelse før implementering.
