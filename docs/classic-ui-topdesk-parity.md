# Classic UI — TOPdesk parity map (from screendumps)

Reference for building `/classic/*` closer to STAR’s current TOPdesk workflow. Same PostgreSQL data and `/api/v1/*` — different shell, navigation, and density.

**Status:** Planning. Scaffold exists (`/classic`, module lists, minimal detail). Next builds follow this document.

**Data model reference:** `docs/topdesk-itsm-data-model-mapping.md` — TOPdesk concepts mapped to PostgreSQL tables and API gaps.

**Your decisions (confirmed):**

| Topic | Decision |
|--------|----------|
| TOPdesk walkthrough | In progress — screendumps 1–10 received; more may follow |
| Separate Changes domain | No — keep `service_request` mapping for now |
| `users.ui_mode` in DB | Yes — planned |
| Rich classic ticket detail | Yes — tabs + actions + timeline |
| Drag-and-drop in classic | No |
| Default UI for new staff | *TBD* (classic vs modern) |

---

## Critical UX pattern: work-area tabs (faneblade)

From **photo 1** and all detail/list shots:

- Multiple views open **horizontally under the top bar** (not only browser tabs).
- Each tab: icon + short title (e.g. `S2510-129 Netværksfejl…`, `SF - Sikkerhedshænd…`).
- **`×` on the right** closes that tab; one tab stays “home” (house / module home).
- Opening a list or a ticket **adds a tab** instead of replacing the whole page.

**STARdesk classic implementation (planned):**

- Client-side tab strip component: `ClassicWorkTabs`
- Tab types: `home` | `list` | `ticket` | `module`
- State: URL per tab optional (`/classic/tickets/[id]` syncs active tab) or in-memory + sessionStorage for tab stack
- Closing tab: remove from stack; focus neighbour

This is the **highest-impact** difference from the current single-page Next.js routes.

---

## Screen map: TOPdesk → STARdesk classic

| # | TOPdesk screen | Screendump | Classic route (target) | Data source (today) |
|---|----------------|------------|------------------------|---------------------|
| 1 | Personal home / widgets | Photo 1 | `/classic` | Tickets counts, news TBD, saved filters TBD |
| 2 | Saved filter list (e.g. SF - Sikkerhedshændelser) | Photo 2 | `/classic/lists/[filterId]` or `/classic/incidents?filter=…` | `GET /api/v1/tickets?…` + client filter |
| 3 | Ticket detail — **Generelt** | Photo 3 | `/classic/tickets/[id]` tab `general` | `GET /api/v1/tickets/{id}` — description, comments, assignment fields |
| 4 | Ticket detail — **Information** | Photo 4 | tab `information` | SLA/timestamps from ticket + `activity` / duration fields where exposed |
| 5 | Ticket detail — **Links → Personer** | Photo 5 | tab `links` → `people` | Partial: requester from ticket; linked persons TBD |
| 6 | Ticket detail — **Release og planlægning** | Photo 6 | tab `release` | Tags/metadata/custom fields — map what exists on `TicketDetail` |
| 7 | Ticket detail — **Udviklingsteam / tags** | Photo 7 | tab `dev-tags` | `ticket.tags`, routing metadata |
| 8 | Ticket detail — **Vedhæftninger → E-mails** | Photo 8 | tab `attachments` → `emails` | Attachments API; email log if exposed on detail |
| 9 | Ticket detail — **Auditspor** | Photo 9 | tab `audit` | `ticket.activity` / `ticket_events` |
| 10 | Module home — **Sagsstyring** | Photo 10 | `/classic/modules/sagsstyring` | Static process diagram + links to lists |
| 11 | Person/org/asset context | Photo 11 *(not received yet)* | `/classic/persons/[id]` or drawer on detail | `User.organization_*`; CMDB `/aktiver` assets |

---

## Photo-by-photo notes

### Photo 1 — Home dashboard

- Dark **left rail**: Søg, Bogmærker, Referencekort, Ny Second line-sag, Vidensbase.
- **TOPdesk menu** (blue) + **tab row** (home icon tab).
- Widgets: Opgaver, Hovedsider (blue tiles), Sikkerhed (saved filters), Seneste nyheder.
- **Classic v2:** Replace tile-only home with widget grid + same left rail + work tabs.

### Photo 2 — List view (SF - Sikkerhedshændelser)

- Title + `FILTER: ingen` + **Ny Second Line-sag** (primary blue).
- Dense table: checkbox, sag-type, sag-nummer, prioritet, status, kort beskrivelse, dato, ansvarliggruppe, ansvarlig, underkategori, miljø…
- Footer: `0 af 38 valgte`.
- Red row = highlight (e.g. assigned + alvorlig).
- **Map columns →** `ticket_type`, `ticket_number`, `priority`, `status`, `title`, `created_at`, `assigned_team_name`, `assigned_user_name`, category/subcategory if available.

### Photo 3 — Detail Generelt (main working view)

- **Work tabs** at top (multiple incidents open).
- Header: number + title; **Gem**, star, refresh, Opret, Mere.
- **Record tabs:** Generelt | Information | Links | Release… | Vedhæftninger (n) | Auditspor (n).
- **Left column (~25%):** Rekvirant (avatar, contact), classification path, Planlægning (prioritet, varighed, forfald), Behandling (gruppe, ansvarlig, status, lukkekode, timestamps).
- **Right (~75%):** Original message (blue), reply editor, thread with avatars.
- **Must have for phase C:** left metadata + comment thread + save/actions.

### Photos 4–9 — Other record tabs

- Same shell as photo 3; only main panel changes.
- **Information:** durations, escalation, major case, service window.
- **Links → Personer:** table (fulde navn, filial, by, lokation, telefon, afdeling, jobtitel) — needs person/link API or simplified requester-only v1.
- **Release:** release, miljø, milestone, patch dato, system, epic, nedetid, SPOC checkboxes, resume af fejl.
- **Dev/tags:** RCA, team prioritering, user story, tags, godkendelse checkboxes.
- **Vedhæftninger → E-mails:** table + message preview pane.
- **Auditspor:** grid Dato/Tid, Feltnavn, Fra, Til, Af, Årsag — map from `activity` / events.

### Photo 10 — Moduler → Sagsstyring

- **Navigator** left: Sagsstyring (active), Ejendomshåndtering, Videnshåndtering, Grunddata.
- **Work tabs** include module tab “Moduler Sagsstyring”.
- Process flowchart (first line / second line / delvise sager).
- Oversigter + Filtreringer + **Ny** tiles (Førstelinje, Second line, Filtrering).
- **Classic route:** `/classic/modules/sagsstyring` — static diagram + deep links to list routes.

### Notifikation (bell, top right)

| TOPdesk | STARdesk classic |
|---------|------------------|
| Bell → modal “Notifikation” | `ClassicTopBarTools` → `ClassicNotificationModal` |
| 4 checkboxes (3 on, group-assignment off by default) | Same labels; `localStorage` per `user.id` |
| Gem / Annullér | Saves on Gem; backdrop / Annullér / × discards unsaved draft |

Delivery of in-app/email notifications from these flags is **not wired** yet — UI + persistence only.

---

### User card — Mine indstillinger (gear / tandhjul, top right)

Opened from **gear icon** next to profile in TOPdesk top bar (same area as calendar/notifications in dumps).

| TOPdesk section | STARdesk today | Classic target |
|-----------------|----------------|----------------|
| Tab “Mine indstillinger” + × | Staff: `TopBarUserMenu` → “Se mere” → `/users/{id}` | `/classic/settings` (work tab) |
| Overblik: visningsmuligheder (rød/i dag, kursiv, forfald…) | — | **Gap** — `user_preferences` JSON or localStorage v1 |
| Opgavelister for grupper | — | **Gap** |
| Default “Gør usynlig for rekvirent” | `ticket_comments.is_internal` per comment | Default on reply form in classic detail |
| Applikationskodeord | — | **Gap** (security policy) |
| E-mail / send kopi | `users.email` | Read-only or PATCH user |
| Sprog | Browser / app locale | **Gap** or `da` only |
| Tilgængelighed (skærmlæser, farver) | — | **Gap** |
| **UI flow (classic vs modern)** | Cookie `stardesk_ui_mode` + login checkbox | **`users.ui_mode`** (planned) — **belongs on this screen** |

**Implementation note:** Add gear button on `ClassicTopBar` → opens “Mine indstillinger” as a **work-area tab** (same faneblade pattern), not only a separate route.

---

### Photo 11 — Org / physical asset (missing file)

You noted: physical asset and org external users belong to. Please attach when ready.

**Likely STARdesk mapping:**

| TOPdesk concept | STARdesk today |
|-----------------|----------------|
| Filial / org | `User.organization_id`, `organization_name` |
| Lokation / asset | CMDB assets (`/aktiver`, `AssetSystem`) — link ticket ↔ asset TBD |
| Person on ticket | Requester fields on ticket; full “Links → Personer” needs link model |

---

## Build phases (recommended order)

### Phase 1 — Shell parity (after any more dumps)

1. `ClassicWorkTabs` — open/close with ×, home tab pinned.
2. Dark **home rail** (photo 1) vs **module navigator** (photo 10).
3. List page template matching photo 2 (toolbar + dense grid + selection footer).

### Phase 2 — Detail Generelt (photo 3)

1. Two-column layout + record tab bar.
2. Left: assignment/status/priority (PATCH existing APIs).
3. Right: comments + reply (existing comment API).
4. Header actions: Gem, refresh (no drag-drop).

### Phase 3 — Remaining record tabs (photos 4–9)

Implement per tab only where API has data; stub with “Ikke konfigureret i STARdesk endnu” otherwise.

### Phase 4 — DB `users.ui_mode`

Migration + session + login redirect (cookie as cache).

### Phase 5 — Org/asset (photo 11)

After screenshot: person drawer + org + optional asset link from ticket.

---

## Open questions for you

1. **More screendumps** — still waiting; send photo 11 (org/asset) when you have it.
2. **Default UI** for new staff users: `classic` or `modern`?
3. **Saved filters** (photo 1 “Sikkerhed”, photo 2 title) — hardcode a few JSON filters in v1, or admin-config later?
4. **Second line vs first line** — map to `ticket_type`, team, or tag (e.g. all `incident` in SF queue)?
5. **Førstelinje / Second line “Ny sag”** — one create form or two templates?

---

## What stays out of scope (confirmed)

- Change management as separate DB entity.
- Drag-and-drop assignment in classic UI.
- Full TOPdesk Ejendomshåndtering / Grunddata modules (only stubs in navigator unless you prioritise them).
