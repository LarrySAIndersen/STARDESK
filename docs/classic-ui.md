# Classic UI flow (TOPdesk-style)

Parallel staff experience at `/classic/*` — same API and database as the modern wireframe UI.

## Routes

| Path | Purpose |
|------|---------|
| `/classic` | Operator home — module tiles with open counts |
| `/classic/incidents` | `ticket_type === incident` |
| `/classic/changes` | `ticket_type === service_request` (placeholder until change entity) |
| `/classic/problems` | `ticket_type === problem` |
| `/classic/service-requests` | `ticket_type === service_request` |
| `/classic/my-work` | Open tickets assigned to current user |
| `/classic/tickets/[id]` | Minimal detail + link to modern `/tickets/[id]` |

## UI mode cookie

- Cookie: `stardesk_ui_mode` = `modern` | `classic`
- Set via `POST /api/auth/ui-mode` (login checkbox or in-app switcher)
- Staff visiting `/` with `classic` cookie are redirected to `/classic`

## Switching flows

- Login: checkbox **Klassisk visning**
- Classic top bar: **Moderne STARdesk**
- Modern sidebar: **Klassisk visning** → `/classic`

## TOPdesk parity spec

See **`docs/classic-ui-topdesk-parity.md`** — screen map from screendumps 1–10, faneblade (× close) requirement, and phased build order.

## Next implementation (agreed)

1. Work-area tabs (faneblade) + list grid (photo 2) + detail Generelt (photo 3)
2. `users.ui_mode` in database
3. Remaining detail tabs where API supports them (photos 4–9)
4. Module home Sagsstyring (photo 10)
5. Org/asset (photo 11 — pending screenshot)
