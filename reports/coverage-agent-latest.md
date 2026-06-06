# Coverage Agent Rapport — 2026-06-06

## Oversigt

- **Test status:** **1188 tests passed** (alle unit tests grønne).
- **Samlet API-dækning:** **80%** (op fra 79% — Quality Gate-målet nået lokalt).
- **Sonar new code:** 75,78% → kræver CI-scan efter merge for at opdatere SonarCloud.

## Gennemførte Forbedringer (Batch 11: Hierarki, Vedhæftninger, Avatar, SLA)

Fire moduler med størst dækningshuller er bragt op på 98–100%:

1. **`ticket_hierarchy.py` (99%):** Async DB-funktioner (`count_children`, `load_parent_ticket`, `get_child_tickets`, `get_related_major_tickets`), `set_parent_ticket_id`, `add/remove_related_major_link`, `broadcast_comment_to_children`, validerings-edge cases og `tickets_to_summaries`.
2. **`attachments.py` (100%):** `upload_root`, list/delete flows (staff/reporter/fejl), `save_ticket_upload` (local + blob), filstørrelsesgrænse, download disposition.
3. **`avatars.py` (98%):** `avatar_public_path`, `avatars_dir`, `extension_for_avatar_content_type`, `write_avatar_bytes`, `resolve_avatar_media_type`, `save_user_avatar` (inkl. erstatning og validering).
4. **`sla_settings_store.py` (93%):** `get_sla_settings_row`, `get_sla_runtime_settings` (read + fallback), `is_status_sla_paused`, `effective_sla_now`, trigger-team SLA clock.

## Batch 10 (allerede færdig)

`org_access.py`, `kanban_access.py`, `ticket_routing.py`, `ticket_intelligence.py` — alle **100%**.

## Næste Batch Prioriteringer (Batch 12)

Moduler med lav dækning og god ROI for Sonar new code:

1. `ticket_hierarchy.py` routers / `tickets.py` router (55%) — integrationstests
2. `personal_service.py` (17%, 99 statements)
3. `user_import.py` (27%, 135 statements)
4. `cmdb_audit.py` (25%, 55 statements)
5. `core/security.py` (76%) — hurtige enhedstests
