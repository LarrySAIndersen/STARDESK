-- 20 vidensartikler (Kubernetes + IT-fejl) til kundeportalen
-- Kør efter knowledge-articles-migration.sql og bruger-seed (fx seed-orgs-30.sql)
-- Synlighed: external | ~15 published + ~5 draft
-- Demo-adgangskoder findes kun i seed-users.sql / kommentarer — ikke i rækkerne herunder.

DO $$
DECLARE
    reporter UUID;
    article RECORD;
    meta JSONB;
    body TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM tickets
        WHERE ticket_number = 'KB-2026-00020' AND is_knowledge_article = TRUE
    ) THEN
        RAISE NOTICE 'KB-2026-00001..00020 already seeded — skipping';
        RETURN;
    END IF;

    SELECT id INTO reporter FROM users WHERE email = 'sfchest01@example.dk' AND deleted_at IS NULL LIMIT 1;
    IF reporter IS NULL THEN
        SELECT id INTO reporter FROM users WHERE role IN ('admin', 'agent') AND deleted_at IS NULL LIMIT 1;
    END IF;
    IF reporter IS NULL THEN
        RAISE EXCEPTION 'No reporter user found — run user seed first';
    END IF;

    FOR article IN
        SELECT * FROM (VALUES
            ('KB-2026-00001', 'Pods starter ikke efter deployment', 'published', ARRAY['kubernetes', 'pods', 'drift', 'fejlsøgning']::varchar[],
             'Deployment ruller ud, men nye pods bliver hængende i ContainerCreating eller CrashLoopBackOff.',
             '- Pod status viser ContainerCreating eller CrashLoopBackOff' || E'\n' || '- kubectl describe pod viser events med fejl',
             '1. Kør kubectl describe pod <navn> -n <namespace> og læs Events.' || E'\n' || '2. Tjek image-navn, tag og pull-secret.' || E'\n' || '3. Verificér ressourcekrav (CPU/hukommelse) mod node-kapacitet.' || E'\n' || '4. Genstart deployment: kubectl rollout restart deployment/<navn>',
             'ImagePullBackOff, namespace quotas, ConfigMap'),
            ('KB-2026-00002', 'Ingress returnerer 502 Bad Gateway', 'published', ARRAY['kubernetes', 'ingress', 'netværk', 'portal']::varchar[],
             'Brugere får 502 når de åbner applikationen via ingress-URL.',
             '- Browser viser 502 Bad Gateway' || E'\n' || '- Direkte port-forward til pod virker',
             '1. Tjek at backend Service har endpoints: kubectl get endpoints.' || E'\n' || '2. Verificér at Service port matcher container port.' || E'\n' || '3. Gennemgå ingress annotations og TLS-secret.' || E'\n' || '4. Læs ingress-controller logs.',
             'Service discovery, TLS-certifikater'),
            ('KB-2026-00003', 'Namespace resource quota overskredet', 'published', ARRAY['kubernetes', 'quota', 'drift']::varchar[],
             'Nye pods kan ikke oprettes fordi namespace har ramt CPU- eller hukommelsesloft.',
             '- Pod events: exceeded quota' || E'\n' || '- kubectl describe quota viser brug tæt på max',
             '1. kubectl describe resourcequota -n <namespace>.' || E'\n' || '2. Slet ubrugte pods eller skaler ned idle deployments.' || E'\n' || '3. Kontakt platform-team hvis loft skal hæves.',
             'Pods starter ikke, HPA'),
            ('KB-2026-00004', 'kubectl: adgang nægtet til cluster', 'published', ARRAY['kubernetes', 'rbac', 'adgang', 'portal']::varchar[],
             'Udvikler får "Forbidden" ved kubectl kommandoer mod produktionscluster.',
             '- Error: User cannot get resource' || E'\n' || '- Virker i test-miljø men ikke prod',
             '1. Bekræft aktiv kubeconfig context.' || E'\n' || '2. Tjek RoleBinding/ClusterRoleBinding for bruger eller gruppe.' || E'\n' || '3. Anmod om adgang via Service Desk med begrundelse og namespace.',
             'Azure AD grupper, break-glass'),
            ('KB-2026-00005', 'ImagePullBackOff ved container start', 'published', ARRAY['kubernetes', 'container', 'fejlsøgning']::varchar[],
             'Pod kan ikke hente container image fra registry.',
             '- Status ImagePullBackOff eller ErrImagePull' || E'\n' || '- Events nævner 401/404 mod registry',
             '1. Verificér image tag findes i registry.' || E'\n' || '2. Tjek imagePullSecrets i ServiceAccount eller pod spec.' || E'\n' || '3. Bekræft netværksadgang fra cluster til registry.',
             'Pods starter ikke, private ACR'),
            ('KB-2026-00006', 'Service kan ikke nås fra andre pods', 'published', ARRAY['kubernetes', 'service', 'netværk']::varchar[],
             'Inter-pod kommunikation fejler selvom pods kører.',
             '- Connection refused eller timeout' || E'\n' || '- curl mod ClusterIP fejler',
             '1. Tjek selector labels på Service og pod.' || E'\n' || '2. Verificér targetPort matcher containerPort.' || E'\n' || '3. Gennemgå NetworkPolicy der kan blokere trafik.',
             'Ingress 502, DNS'),
            ('KB-2026-00007', 'VPN-forbindelse fejler hjemmefra', 'published', ARRAY['vpn', 'fjernarbejde', 'portal', 'fejlsøgning']::varchar[],
             'Medarbejder kan ikke oprette VPN til STAR netværk fra hjemmepc.',
             '- VPN-klient hænger på "Connecting"' || E'\n' || '- Fejl om certifikat eller MFA',
             '1. Genstart VPN-klient og pc.' || E'\n' || '2. Tjek at MFA-app er aktiv (se MFA-artikel).' || E'\n' || '3. Ryd gammel VPN-profil og importer ny fra IT-portal.' || E'\n' || '4. Kontakt Service Desk hvis fejl fortsætter.',
             'MFA-kode, langsom pc'),
            ('KB-2026-00008', 'Outlook synkroniserer ikke mail', 'published', ARRAY['outlook', 'mail', 'office365', 'portal']::varchar[],
             'Outlook viser "Trying to connect" eller manglende nye mails.',
             '- Statuslinje: Disconnected' || E'\n' || '- Webmail (outlook.office.com) virker',
             '1. Luk Outlook helt (Task Manager).' || E'\n' || '2. Kør Office reparation fra Kontrolpanel.' || E'\n' || '3. Opret ny Outlook-profil hvis nødvendigt.' || E'\n' || '4. Tjek VPN hvis du er hjemme.',
             'VPN, adgangskode'),
            ('KB-2026-00009', 'Sådan nulstiller du din adgangskode', 'published', ARRAY['adgangskode', 'login', 'selvbetjening', 'portal']::varchar[],
             'Trin-for-trin til selvbetjent nulstilling af Windows/AD adgangskode.',
             '- Glemt adgangskode ved login' || E'\n' || '- Konto låst efter for mange forsøg',
             '1. Gå til login.star.dk og vælg "Glemt adgangskode".' || E'\n' || '2. Bekræft med MFA.' || E'\n' || '3. Vælg nyt kodeord der opfylder kompleksitetskrav.' || E'\n' || '4. Vent 15 min hvis sync mod gamle systemer.',
             'MFA, Citrix'),
            ('KB-2026-00010', 'Netværksprinter udskriver ikke', 'published', ARRAY['printer', 'udskrift', 'fejlsøgning']::varchar[],
             'Dokumenter kommer ikke ud på valgt netværksprinter.',
             '- Job forbliver i køen' || E'\n' || '- Offline status på printer',
             '1. Tjek printer er tændt og på netværk.' || E'\n' || '2. Fjern og tilføj printer i Windows Indstillinger.' || E'\n' || '3. Genstart Print Spooler service.' || E'\n' || '4. Prøv udskrift til PDF for at isolere driver.',
             'VPN hjemmefra'),
            ('KB-2026-00011', 'Citrix-session afbrydes hyppigt', 'published', ARRAY['citrix', 'vdi', 'fjernskrivebord', 'portal']::varchar[],
             'Citrix Workspace logger brugeren ud eller fryser session.',
             '- Session timeout efter få minutter' || E'\n' || '- Sort skærm i session',
             '1. Opdater Citrix Workspace til seneste version.' || E'\n' || '2. Tjek stabil internetforbindelse (kablet hvis muligt).' || E'\n' || '3. Ryd Citrix cache under %APPDATA%.' || E'\n' || '4. Opret sag med tidspunkt hvis mønster fortsætter.',
             'VPN, langsom pc'),
            ('KB-2026-00012', 'MFA-kode modtages ikke på telefon', 'published', ARRAY['mfa', 'sikkerhed', 'login', 'portal']::varchar[],
             'Microsoft Authenticator viser ikke godkendelsesprompt.',
             '- Ingen push-notifikation' || E'\n' || '- TOTP-kode afvist',
             '1. Tjek telefon har netværk og korrekt tid (automatisk).' || E'\n' || '2. Åbn Authenticator manuelt og vælg konto.' || E'\n' || '3. Brug alternativ metode (SMS/telefon) hvis konfigureret.' || E'\n' || '4. Kontakt Service Desk for MFA-nulstilling.',
             'Adgangskode, VPN'),
            ('KB-2026-00013', 'PC kører langsomt efter login', 'published', ARRAY['performance', 'pc', 'fejlsøgning', 'portal']::varchar[],
             'Windows føles langsom ved opstart og i daglig brug.',
             '- Høj CPU i Task Manager' || E'\n' || '- Disk 100% i Performance-fane',
             '1. Genstart pc (ikke kun sleep).' || E'\n' || '2. Deaktiver unødvendige startup-programmer.' || E'\n' || '3. Kør Windows Update og genstart.' || E'\n' || '4. Kontakt Service Desk hvis slowness efter patch.',
             'Citrix, Outlook'),
            ('KB-2026-00014', 'ConfigMap-ændringer træder ikke i kraft', 'published', ARRAY['kubernetes', 'configmap', 'drift']::varchar[],
             'Applikation læser stadig gammel konfiguration efter ConfigMap opdatering.',
             '- Miljøvariabel i pod matcher ikke ny værdi' || E'\n' || '- Kun nye pods har rigtig config',
             '1. Husk at ConfigMaps ikke auto-reloades i kørende pods.' || E'\n' || '2. kubectl rollout restart deployment/<navn>.' || E'\n' || '3. Tjek volume mount subPath og filrettigheder.',
             'Pods, deployments'),
            ('KB-2026-00015', 'PersistentVolume forbliver Pending', 'published', ARRAY['kubernetes', 'storage', 'pv', 'drift']::varchar[],
             'PVC binder ikke til PV og pod kan ikke starte.',
             '- PVC status Pending' || E'\n' || '- Events om provisioning fejl',
             '1. kubectl describe pvc og pv.' || E'\n' || '2. Tjek storageClass findes og provisioner kører.' || E'\n' || '3. Verificér kapacitet og access mode.',
             'Pods starter ikke, quota'),
            ('KB-2026-00016', 'HPA skalerer ikke automatisk (kladde)', 'draft', ARRAY['kubernetes', 'hpa', 'kladde']::varchar[],
             'Horizontal Pod Autoscaler reagerer ikke på load.',
             '- Replica count fast' || E'\n' || '- Metrics mangler i kubectl get hpa',
             '1. Tjek metrics-server er installeret.' || E'\n' || '2. Verificér resource requests på pods.' || E'\n' || '3. Gennemgå HPA target CPU/memory procent.',
             'Metrics-server, quota'),
            ('KB-2026-00017', 'Roter Kubernetes secrets (kladde)', 'draft', ARRAY['kubernetes', 'secrets', 'sikkerhed', 'kladde']::varchar[],
             'Intern procedure for rotation af TLS- og database-secrets.',
             '- Secret ældre end 90 dage' || E'\n' || '- Compliance kræver rotation',
             '1. Opret nyt secret med suffiks -v2.' || E'\n' || '2. Opdater deployment envFrom.' || E'\n' || '3. Rollout og slet gammelt secret efter validering.',
             'RBAC, CI/CD'),
            ('KB-2026-00018', 'Teams mangler lyd i møde (kladde)', 'draft', ARRAY['teams', 'møde', 'office365', 'kladde']::varchar[],
             'Deltagere hører ikke hinanden i Teams-møde.',
             '- Mikrofon ikon slået fra' || E'\n' || '- Forkert output-enhed valgt',
             '1. Tjek Teams enhedsindstillinger.' || E'\n' || '2. Test med Teams testopkald.' || E'\n' || '3. Opdater lyddriver.',
             'Citrix, headset'),
            ('KB-2026-00019', 'Fjernskrivebord afbrydes efter 10 min (kladde)', 'draft', ARRAY['rdp', 'fjernskrivebord', 'kladde']::varchar[],
             'RDP-session til server lukker ved inaktivitet.',
             '- Session disconnected' || E'\n' || '- Gælder kun bestemte servere',
             '1. Tjek gruppepolitik for session timeout.' || E'\n' || '2. Hold session aktiv med godkendt brug.' || E'\n' || '3. Kontakt server-ejer for undtagelse.',
             'Citrix, VPN'),
            ('KB-2026-00020', 'BitLocker recovery-nøgle (kladde)', 'draft', ARRAY['bitlocker', 'sikkerhed', 'kladde']::varchar[],
             'PC beder om recovery key efter hardwareændring.',
             '- Blå BitLocker skærm ved boot' || E'\n' || '- TPM fejl efter bundkortskifte',
             '1. Hent recovery key fra IT self-service portal.' || E'\n' || '2. Indtast 48-cifret nøgle.' || E'\n' || '3. Kontakt Service Desk hvis nøgle mangler.',
             'Adgangskode, pc')
        ) AS t(ticket_number, title, k_status, tags, summary, symptoms, solution, related)
    LOOP
        meta := jsonb_build_object(
            'knowledge', jsonb_build_object(
                'summary', article.summary,
                'symptoms', article.symptoms,
                'solution', article.solution,
                'related_topics', article.related
            )
        );
        body := '## Resumé' || E'\n' || article.summary || E'\n\n'
            || '## Symptomer' || E'\n' || article.symptoms || E'\n\n'
            || '## Løsning' || E'\n' || article.solution || E'\n\n'
            || '## Relaterede emner' || E'\n' || article.related;

        INSERT INTO tickets (
            id,
            ticket_number,
            ticket_type,
            title,
            description,
            status,
            priority,
            reporter_user_id,
            source,
            created_at,
            updated_at,
            is_knowledge_article,
            knowledge_status,
            knowledge_visibility,
            tags,
            routing_metadata
        ) VALUES (
            gen_random_uuid(),
            article.ticket_number,
            'incident',
            article.title,
            body,
            'closed',
            'low',
            reporter,
            'knowledge',
            NOW() - (random() * interval '30 days'),
            NOW() - (random() * interval '3 days'),
            TRUE,
            article.k_status,
            'external',
            article.tags,
            meta
        );
    END LOOP;

    RAISE NOTICE 'Seeded 20 knowledge articles (KB-2026-00001..00020)';
END $$;
