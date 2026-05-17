-- Underårsager per kategori — run after ticket-underaarsag-migration.sql

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'login_failure', 'Login fejler', 10 FROM categories c WHERE c.name = 'access'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'login_failure' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'password_reset', 'Nulstilling af adgangskode', 20 FROM categories c WHERE c.name = 'access'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'password_reset' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'permissions', 'Manglende rettigheder', 30 FROM categories c WHERE c.name = 'access'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'permissions' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'app_crash', 'Applikation crasher', 10 FROM categories c WHERE c.name = 'software'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'app_crash' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'slow_performance', 'Langsom ydeevne', 20 FROM categories c WHERE c.name = 'software'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'slow_performance' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'update_issue', 'Fejl efter opdatering', 30 FROM categories c WHERE c.name = 'software'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'update_issue' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'device_broken', 'Enhed virker ikke', 10 FROM categories c WHERE c.name = 'hardware'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'device_broken' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'peripheral', 'Tilbehør defekt', 20 FROM categories c WHERE c.name = 'hardware'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'peripheral' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'connectivity', 'Ingen forbindelse', 10 FROM categories c WHERE c.name = 'network'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'connectivity' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'vpn', 'VPN-problem', 20 FROM categories c WHERE c.name = 'network'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'vpn' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'wifi', 'Wi-Fi ustabilt', 30 FROM categories c WHERE c.name = 'network'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'wifi' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'general_unknown', 'Ukendt årsag', 10 FROM categories c WHERE c.name = 'other'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'general_unknown' AND s.category_id = c.id);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT c.id, 'user_error', 'Brugerfejl', 20 FROM categories c WHERE c.name = 'other'
AND NOT EXISTS (SELECT 1 FROM sub_causes s WHERE s.name = 'user_error' AND s.category_id = c.id);

-- Generelle underårsager (alle kategorier)
INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT NULL, 'outage', 'Driftsafbrydelse', 5
WHERE NOT EXISTS (SELECT 1 FROM sub_causes WHERE name = 'outage' AND category_id IS NULL);

INSERT INTO sub_causes (category_id, name, name_da, sort_order)
SELECT NULL, 'third_party', 'Tredjepartsleverandør', 15
WHERE NOT EXISTS (SELECT 1 FROM sub_causes WHERE name = 'third_party' AND category_id IS NULL);
