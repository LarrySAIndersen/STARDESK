"""Generate docs/seed-orgs-30.sql — run from repo root: python scripts/gen_seed_orgs.py"""

from pathlib import Path

PWD = "$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC"

ORGS = [
    ("Virksomhed", "estrifft"),
    ("North Star", "northstar"),
    ("Jobflow", "jobflow"),
    ("SF Koncern", "sfkoncern"),
    ("Nordisk Forsyning", "forsyning"),
    ("Kommune IT Vest", "kommune"),
    ("ErhvervsPartner", "erhverv"),
    ("MedTech Ost", "medtech"),
    ("Retail Alliance", "retail"),
]

lines = [
    "-- 10 indmelder-organisationer, 30 agenter (3 per gruppe)",
    "-- Password for all: Stardesk2026!",
    "-- Run docs/org-migration.sql first, then this file in Neon",
    "",
]

for i, (name, slug) in enumerate(ORGS, 1):
    oid = f"e1000001-0000-4000-8000-{i:012d}"
    safe_name = name.replace("'", "''")
    lines.append(
        f"INSERT INTO organizations (id, name, description, is_active) VALUES "
        f"('{oid}', '{safe_name}', 'Indmelder-organisation', TRUE) "
        f"ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_active = TRUE;"
    )
    lines.append(
        f"INSERT INTO teams (name, description, is_active, organization_id) VALUES "
        f"('{safe_name}', 'Gruppe for {safe_name}', TRUE, "
        f"(SELECT id FROM organizations WHERE name = '{safe_name}')) "
        f"ON CONFLICT (name) DO UPDATE SET organization_id = EXCLUDED.organization_id, is_active = TRUE;"
    )
    for j in range(1, 4):
        uid_num = (i - 1) * 3 + j
        uid = f"b2000001-0000-4000-8000-{uid_num:012d}"
        email = f"{slug}{j:02d}@example.dk"
        dname = f"{name} Agent {j}".replace("'", "''")
        lines.append(
            f"INSERT INTO users (id, email, display_name, role, is_active, "
            f"password_hash, organization_id) VALUES "
            f"('{uid}', '{email}', '{dname}', 'agent', TRUE, '{PWD}', "
            f"(SELECT id FROM organizations WHERE name = '{safe_name}')) "
            f"ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, "
            f"organization_id = EXCLUDED.organization_id, password_hash = EXCLUDED.password_hash;"
        )
        lines.append(
            f"INSERT INTO team_members (team_id, user_id, joined_at) "
            f"SELECT t.id, '{uid}'::uuid, NOW() FROM teams t "
            f"WHERE t.name = '{safe_name}' "
            f"ON CONFLICT DO NOTHING;"
        )
    lines.append("")

out = Path(__file__).resolve().parents[1] / "docs" / "seed-orgs-30.sql"
out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out} ({len(lines)} lines)")
