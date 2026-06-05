# Coverage Agent Rapport — 2026-06-05

## Oversigt

- **Linjedækning:** **68.3%** (7232 / 10589 statements) — en stigning på **+0.4%** i forhold til forrige scan (67.9%).
- **Branchdækning:** **46.8%** (1341 / 2868 branches) — en stigning på **+2.0%** i forhold til forrige scan (44.8%).
- **Test status:** **653 tests passed** (alle unit tests grønne).

## Gennemførte Forbedringer (Batch 7: Flere Lavthængende Frugter)

Vi har bragt 8 mindre moduler og hjælpefunktioner til **100% testdækning**:

1. **`ticket_numbers.py` (100%):** Dækket fejlhåndtering og fallback ved ugyldige sagsnumre.
2. **`db_resilience.py` (100%):** Dækket savepoint rollback-fejl og asynkrone context manager fallbacks.
3. **`slack_mock.py` (100%):** Dækket opslag af mock Slack-kanaler (både fundne og ikke-fundne).
4. **`sole_top_admin.py` (100%):** Dækket automatisk demotion af uautoriserede top_admins og promotion af ejeren ved login.
5. **`ticket_classification.py` (100%):** Dækket validering af kategorier, underkategorier og kilder (herunder inaktive elementer).
6. **`cmdb_catalog.py` (100%):** Dækket oprettelse og opdatering af CMDB-kataloget i PostgreSQL.
7. **`sla_calendar.py` (100%):** Dækket tidsberegning over weekender og asynkrone tidszoner.
8. **`workboard_status_guard.py` (100%):** Dækket status- transitionsregler på Kanban-tavlen.

## Bekræftelse & Deliverable Gate

- **Deliverable Gate:** **PASSED** (lokal hello-world test fuldført med succes via `pwsh scripts/run-deliverable-gate.ps1`).
- Alle 653 unit tests kørte og bestod uden fejl.

## Næste Batch Prioriteringer (Batch 8: Næste Lavthængende Frugter)

Følgende moduler er de næste oplagte mål for at øge dækningen yderligere:

1. `permissions.py` (79% dækning, 28 statements)
2. `ticket_tags.py` (83% dækning, 32 statements)
3. `ticket_timestamps.py` (90% dækning, 23 statements)
4. `cpr.py` (84% dækning, 37 statements)
5. `kanban_defaults.py` (83% dækning, 46 statements)
6. `sla_status.py` (72% dækning, 27 statements)
7. `ticket_sort.py` (72% dækning, 26 statements)
8. `ticket_intake_assist.py` (71% dækning, 48 statements)
