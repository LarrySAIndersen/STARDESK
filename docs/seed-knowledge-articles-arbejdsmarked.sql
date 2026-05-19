-- 35 vidensartikler (arbejdsmarked / STAR / jobcenter / borger) til kundeportalen
-- Kør efter knowledge-articles-migration.sql og bruger-seed (fx seed-orgs-30.sql)
-- Synlighed: external | ~28 published + ~7 draft
-- KB-numre: KB-2026-00021..00055 (efter kubernetes-it seed 00001..00020)

DO $$
DECLARE
    reporter UUID;
    article RECORD;
    meta JSONB;
    body TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM tickets
        WHERE ticket_number = 'KB-2026-00055' AND is_knowledge_article = TRUE
    ) THEN
        RAISE NOTICE 'KB-2026-00021..00055 already seeded — skipping';
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
            ('KB-2026-00021', 'Sådan opretter og opdaterer du dit CV på jobnet.dk', 'published', ARRAY['jobcenter', 'cv', 'jobnet', 'selvbetjening']::varchar[],
             'Guide til oprettelse, redigering og publicering af CV på jobnet.dk så jobcentret kan se din profil.',
             '- Kan ikke finde knappen til at oprette CV' || E'\n' || '- CV gemmes ikke eller vises tomt for sagsbehandler',
             '1. Log ind på jobnet.dk med MitID.' || E'\n' || '2. Vælg Mit CV og Opret nyt CV eller Rediger.' || E'\n' || '3. Udfyld erfaring, uddannelse og kompetencer — gem undervejs.' || E'\n' || '4. Sæt CV til Synlig for arbejdsgivere hvis du søger job aktivt.',
             'Ansøgning, joblog, kompetenceprofil'),
            ('KB-2026-00022', 'Upload og vedhæftelse af ansøgning i joblog', 'published', ARRAY['joblog', 'ansøgning', 'selvbetjening', 'jobcenter']::varchar[],
             'Sådan uploader du ansøgning og dokumentation i joblog som jobcentret kræver.',
             '- Fil afvises ved upload' || E'\n' || '- Ansøgning vises ikke som indsendt',
             '1. Log ind på selvbetjening og åbn joblog.' || E'\n' || '2. Vælg den aktuelle periode og Tilføj ansøgning.' || E'\n' || '3. Brug PDF eller Word — max filstørrelse står på siden.' || E'\n' || '4. Bekræft indsendelse og tjek status er markeret som indsendt.',
             'CV, fejl ved indsendelse, digital post'),
            ('KB-2026-00023', 'Virksomhedspraktik — tilmelding og forløb', 'published', ARRAY['virksomhedspraktik', 'jobcenter', 'aktivering', 'arbejdsmarked']::varchar[],
             'Overblik over hvordan virksomhedspraktik aftales mellem borger, jobcenter og virksomhed.',
             '- Usikker på om praktik tæller som jobsøgning' || E'\n' || '- Mangler bekræftelse fra virksomhed',
             '1. Tal med din sagsbehandler om praktik som led i din plan.' || E'\n' || '2. Jobcentret indgår aftale med virksomheden.' || E'\n' || '3. Registrér timer og fremmøde som aftalt i joblog.' || E'\n' || '4. Kontakt jobcenter ved sygdom eller aflysning.',
             'Aktivering, transportgodtgørelse, CV'),
            ('KB-2026-00024', 'Sygedagpenge — overblik for borgere', 'published', ARRAY['sygedagpenge', 'a-kasse', 'selvbetjening', 'borger']::varchar[],
             'Generel vejledning om sygedagpenge, indberetning og hvem du kontakter ved spørgsmål.',
             '- Usikker på om jeg er omfattet af sygedagpenge' || E'\n' || '- Mangler svar på indsendt sygemelding',
             '1. Kontakt din a-kasse eller arbejdsgiver afhængigt af din situation.' || E'\n' || '2. Indberet sygdom digitalt hos a-kasse/arbejdsgiver som anvist.' || E'\n' || '3. Gem dokumentation for lægebesøg og sygemelding.' || E'\n' || '4. Ved ledighed og sygdom — kontakt jobcenter for samspil med ydelser.',
             'Ferie ved sygdom, barsel, digital post'),
            ('KB-2026-00025', 'Ferie og feriepenge ved ledighed', 'published', ARRAY['ferie', 'dagpenge', 'ledighed', 'jobcenter']::varchar[],
             'Hvordan ferie påvirker dagpenge og joblog, og hvornår du skal give besked.',
             '- Usikker på om jeg må tage ferie uden at miste ydelse' || E'\n' || '- Ferie registreres forkert i systemet',
             '1. Anmeld planlagt ferie til jobcenter og a-kasse i god tid.' || E'\n' || '2. Opdater joblog så perioden ikke forventer jobsøgning.' || E'\n' || '3. Ved afslag eller fejl — indsend dokumentation for ferieaftale.' || E'\n' || '4. Læs brev om feriegodtgørelse i digital post.',
             'Sygedagpenge, joblog, a-kasse'),
            ('KB-2026-00026', 'Barsel og forældorpenge — hvor starter jeg', 'published', ARRAY['barsel', 'forældorpenge', 'borger', 'selvbetjening']::varchar[],
             'Vejen til barsel og forældorpenge via Udbetaling Danmark, arbejdsgiver eller a-kasse.',
             '- Ved ikke hvilket link eller formular der gælder' || E'\n' || '- Jobcenter og a-kasse giver modstridende svar',
             '1. Tjek din situation på borger.dk og Udbetaling Danmarks selvbetjening.' || E'\n' || '2. Giv jobcenter besked hvis du er på dagpenge eller i aktivering.' || E'\n' || '3. Indberet orlov og forventet fravær til arbejdsgiver.' || E'\n' || '4. Kontakt a-kasse for samspil med dagpenge under barsel.',
             'Sygedagpenge, digital post, MitID'),
            ('KB-2026-00027', 'Digital post fra det offentlige', 'published', ARRAY['digital-post', 'eboks', 'selvbetjening', 'borger']::varchar[],
             'Sådan læser du breve fra jobcenter, STAR og andre myndigheder i digital post.',
             '- Har ikke modtaget brev sagsbehandler henviser til' || E'\n' || '- Kan ikke åbne vedhæftet PDF',
             '1. Log ind på borger.dk eller e-Boks med MitID.' || E'\n' || '2. Tjek mappen for det offentlige og jobcenter/STAR.' || E'\n' || '3. Slå notifikation til så du ikke overser frister.' || E'\n' || '4. Ved tekniske fejl — prøv anden browser eller kontakt support.',
             'MitID, frister i joblog, GDPR'),
            ('KB-2026-00028', 'MitID virker ikke ved login på selvbetjening', 'published', ARRAY['mitid', 'login', 'selvbetjening', 'fejlsøgning']::varchar[],
             'Fejlsøgning når MitID-app, kodeoplæser eller chip ikke godkender login.',
             '- App siger godkendelse udløbet' || E'\n' || '- QR-kode scannes men siden loader ikke',
             '1. Opdater MitID-app og tjek telefon har netværk.' || E'\n' || '2. Sæt automatisk tid og dato på enheden.' || E'\n' || '3. Prøv MitID kodeoplæser eller chip hvis app fejler.' || E'\n' || '4. Kontakt MitID support eller jobcenter telefonlinje ved vedvarende fejl.',
             'Browserfejl, mobil app, adgangskode'),
            ('KB-2026-00029', 'Find åbningstider og adresse til dit jobcenter', 'published', ARRAY['jobcenter', 'kontakt', 'åbningstider', 'borger']::varchar[],
             'Sådan finder du det rigtige jobcenter, åbningstider og booking af fremmøde.',
             '- Usikker på hvilket jobcenter jeg hører til' || E'\n' || '- Telefon kø er lang — vil booke tid',
             '1. Brug Find jobcenter på jobindsats.dk med postnummer.' || E'\n' || '2. Tjek åbningstider for telefon og personligt fremmøde.' || E'\n' || '3. Book tid via selvbetjening hvis du er inviteret til møde.' || E'\n' || '4. Ved flytning — opdater adresse i Folkeregisteret først.',
             'STAR kontakt, fremmøde, digital post'),
            ('KB-2026-00030', 'Kontakt STAR — telefon, skriftlig henvendelse og svar', 'published', ARRAY['star', 'kontakt', 'telefon', 'borger']::varchar[],
             'Kanaler til at kontakte STAR ved spørgsmål om ydelser, it og sagsgang.',
             '- Ved ikke hvilket nummer der gælder for min sag' || E'\n' || '- Ingen svar på skriftlig henvendelse',
             '1. Find aktuelle telefonnumre på star.dk under Kontakt.' || E'\n' || '2. Hav CPR, sagstype og evt. sagsnummer klar.' || E'\n' || '3. Skriftlige henvendelser via digital post eller sag i selvbetjening.' || E'\n' || '4. Notér sagsreference ved indsendelse for opfølgning.',
             'Jobcenter, åbningstider, digital post'),
            ('KB-2026-00031', 'Fejlmeddelelse ved indsendelse af joblog', 'published', ARRAY['joblog', 'fejlsøgning', 'selvbetjening', 'jobcenter']::varchar[],
             'Typiske fejl når joblog ikke kan gemmes eller indsendes, og hvad du gør.',
             '- Rød fejltekst ved Gem eller Indsend' || E'\n' || '- Periode er låst men oplysninger mangler',
             '1. Læs fejlteksten — ofte mangler aktivitet eller dokumentation.' || E'\n' || '2. Tjek at perioden matcher den uge du indberetter for.' || E'\n' || '3. Log ud, ryd cache, prøv igen i Chrome eller Edge.' || E'\n' || '4. Kontakt jobcenter med skærmbillede hvis fejlen gentages.',
             'CV upload, browser, MitID'),
            ('KB-2026-00032', 'Selvbetjening virker ikke i browser på pc', 'published', ARRAY['selvbetjening', 'browser', 'fejlsøgning', 'portal']::varchar[],
             'Løsninger når STAR- eller jobcenter-sider ikke loader, fryser eller viser blank side.',
             '- Hvid side efter login' || E'\n' || '- Knapper reagerer ikke',
             '1. Opdater browser og slå pop-up blokering fra for siden.' || E'\n' || '2. Prøv privat vindue uden udvidelser.' || E'\n' || '3. Tjek at JavaScript er aktiveret.' || E'\n' || '4. Skift til understøttet browser — se hjælpetekst på login-siden.',
             'MitID, mobil app, joblog'),
            ('KB-2026-00033', 'GDPR og samtykke til behandling af oplysninger', 'published', ARRAY['gdpr', 'samtykke', 'databeskyttelse', 'borger']::varchar[],
             'Dine rettigheder, samtykke og hvordan du anmoder om indsigt i sagsoplysninger.',
             '- Vil vide hvilke data jobcenter gemmer' || E'\n' || '- Ønsker at trække samtykke tilbage',
             '1. Læs privatlivspolitik på star.dk og jobcenterets hjemmeside.' || E'\n' || '2. Anmod om indsigt via kontaktformular eller digital post.' || E'\n' || '3. Samtykke til deling med a-kasse/andre kan administreres i selvbetjening hvor tilgængeligt.' || E'\n' || '4. Klage til Datatilsynet ved uenighed om behandling.',
             'Digital post, sagsbehandler, MitID'),
            ('KB-2026-00034', 'A-kasse og dagpenge — hvem kontakter jeg', 'published', ARRAY['a-kasse', 'dagpenge', 'ledighed', 'borger']::varchar[],
             'Afgrænsning mellem a-kasse, jobcenter og STAR ved spørgsmål om dagpenge.',
             '- Usikker på om fejl er hos a-kasse eller jobcenter' || E'\n' || '- Udbetaling udeblevet',
             '1. Dagpenge og medlemskab — kontakt din a-kasse først.' || E'\n' || '2. Aktivering, joblog og møder — jobcenter.' || E'\n' || '3. STAR it og fælles selvbetjening — STAR support.' || E'\n' || '4. Medbring sagsnumre fra begge parter ved tværgående spørgsmål.',
             'Ledighed, rådighed, joblog'),
            ('KB-2026-00035', 'Ledighed — digital tilmelding og første møde', 'published', ARRAY['ledighed', 'jobcenter', 'selvbetjening', 'borger']::varchar[],
             'Trin fra ledig til tilmeldt med første kontakt til jobcenter og a-kasse.',
             '- Ved ikke om tilmelding er gennemført' || E'\n' || '- Mangler invitation til opstartssamtale',
             '1. Tilmeld dig digitalt som ledig på jobnet.dk med MitID.' || E'\n' || '2. Kontakt a-kasse inden for 7 dage som reglerne kræver.' || E'\n' || '3. Læs digital post for mødeindkaldelse.' || E'\n' || '4. Medbring CV og evt. uddannelsesbevis til første møde.',
             'CV, a-kasse, digital post'),
            ('KB-2026-00036', 'Aktivering og samtaler med jobcenter', 'published', ARRAY['aktivering', 'jobcenter', 'møde', 'borger']::varchar[],
             'Forberedelse til aktivering, samtaler og hvad jobcentret forventer af dig.',
             '- Forstår ikke indholdet i min aktiveringsplan' || E'\n' || '- Kan ikke deltage i planlagt kursus',
             '1. Læs aktiveringsplanen i digital post og notér spørgsmål.' || E'\n' || '2. Giv besked ved sygdom eller force majeure før aktivitet starter.' || E'\n' || '3. Dokumentér jobsøgning og fremmøde i joblog.' || E'\n' || '4. Bed om gennemgang af plan ved ændret helbred eller familieforhold.',
             'Virksomhedspraktik, rådighed, joblog'),
            ('KB-2026-00037', 'Efterløn og seniorordninger — generel vejledning', 'published', ARRAY['efterløn', 'senior', 'pension', 'borger']::varchar[],
             'Overblik over efterløn og seniorjob uden at erstatte a-kasse eller pensionsrådgivning.',
             '- Usikker på om efterløn påvirker dagpenge' || E'\n' || '- Søger information om seniorjob',
             '1. Kontakt a-kasse eller fagforening for efterlønsregler.' || E'\n' || '2. Jobcenter kan vejlede om seniorjob og lokale tilbud.' || E'\n' || '3. Tjek pensionsalder og overgangsordninger på borger.dk.' || E'\n' || '4. Indberet ændret indkomst til relevante myndigheder.',
             'Fleksjob, førtidspension, dagpenge'),
            ('KB-2026-00038', 'Feriekort og feriegodtgørelse ved sygdom eller ledighed', 'published', ARRAY['feriekort', 'ferie', 'sygedagpenge', 'borger']::varchar[],
             'Sådan bruger og forstår du feriekort og feriegodtgørelse i overgangssituationer.',
             '- Feriekort afvist i butik' || E'\n' || '- Modregning mod ydelse',
             '1. Tjek saldo og gyldighed på feriekort.dk.' || E'\n' || '2. Ved ledighed — læs brev om feriegodtgørelse fra a-kasse.' || E'\n' || '3. Kontakt a-kasse ved forkert udbetaling.' || E'\n' || '4. Gem dokumentation for afviklet ferie.',
             'Ferie ved ledighed, sygedagpenge'),
            ('KB-2026-00039', 'STAR og jobcenter på mobil — app og MitID', 'published', ARRAY['mobil', 'app', 'mitid', 'selvbetjening']::varchar[],
             'Brug af mobil til joblog, digital post og MitID når du ikke sidder ved pc.',
             '- App crasher ved login' || E'\n' || '- Kan ikke uploade dokument fra telefon',
             '1. Opdater app fra officiel butik (App Store / Google Play).' || E'\n' || '2. Brug mobilbrowser til selvbetjening hvis app fejler.' || E'\n' || '3. Upload PDF fra telefonens filer — undgå screenshot hvis krævet PDF.' || E'\n' || '4. Ved MitID på mobil — hold app opdateret og brug biometri.',
             'MitID, browser, joblog'),
            ('KB-2026-00040', 'CV-hjælp og kompetenceprofil til jobcenter', 'published', ARRAY['cv', 'kompetence', 'jobcenter', 'jobsøgning']::varchar[],
             'Sådan bruger du kompetenceprofil og CV-hjælp i samarbejde med jobcenter.',
             '- CV matcher ikke de job jeg søger' || E'\n' || '- Kompetenceprofil er tom',
             '1. Udfyld kompetenceprofil på jobnet.dk.' || E'\n' || '2. Book CV-samtale via jobcenter hvis tilbudt.' || E'\n' || '3. Tilpas CV til hvert stillingsopslag — vedhæft i joblog.' || E'\n' || '4. Brug STAR-skabeloner hvis delt af sagsbehandler.',
             'Ansøgning, virksomhedspraktik, joblog'),
            ('KB-2026-00041', 'Jobsøgning og ansøgningsskabeloner', 'published', ARRAY['jobsøgning', 'ansøgning', 'cv', 'borger']::varchar[],
             'Tips til struktureret jobsøgning og brug af skabeloner uden at garantere ansættelse.',
             '- Sender mange ansøgninger uden svar' || E'\n' || '- Usikker på længde på ansøgning',
             '1. Søg relevante stillinger og tilpas ansøgning til opslaget.' || E'\n' || '2. Registrér hver ansøgning i joblog med dokumentation.' || E'\n' || '3. Brug korte motiverede ansøgninger — CV som bilag.' || E'\n' || '4. Følg op efter 1–2 uger hvor det er passende.',
             'CV, jobnet, aktivering'),
            ('KB-2026-00042', 'Rejse og transport til møde og aktivering', 'published', ARRAY['transport', 'godtgørelse', 'møde', 'jobcenter']::varchar[],
             'Refusion og regler for transport til jobcenter, kursus og virksomhedspraktik.',
             '- Ved ikke om jeg kan få betalt busbillet' || E'\n' || '- Afvist refusion',
             '1. Spørg sagsbehandler om du er omfattet af transportgodtgørelse.' || E'\n' || '2. Gem kvitteringer og billetter i original eller digital form.' || E'\n' || '3. Indsend refusion via selvbetjening eller formular som anvist.' || E'\n' || '4. Indberet sygdom så du ikke rejser unødigt.',
             'Aktivering, virksomhedspraktik, møde'),
            ('KB-2026-00043', 'Økonomisk hjælp og særlige ydelser', 'published', ARRAY['økonomi', 'ydelser', 'borger', 'jobcenter']::varchar[],
             'Introduktion til kontanthjælp, boligstøtte og særlige tilskud — ikke individuel beregning.',
             '- Kan ikke betale faste udgifter' || E'\n' || '- Usikker på hvilken ydelse jeg har ret til',
             '1. Kontakt jobcenter for samtale om økonomisk situation.' || E'\n' || '2. Tjek borger.dk for boligstøtte og andre tilskud.' || E'\n' || '3. Medbring budget og dokumentation for udgifter.' || E'\n' || '4. Søg socialrådgivning i kommunen ved akut krise.',
             'Dagpenge, a-kasse, digital post'),
            ('KB-2026-00044', 'Rådighed og sanktioner — borgerens overblik', 'published', ARRAY['rådighed', 'sanktion', 'dagpenge', 'jobcenter']::varchar[],
             'Hvad rådighed betyder, typiske årsager til sanktion og hvordan du klager.',
             '- Modtaget brev om nedsættelse af ydelse' || E'\n' || '- Mener jeg har overholdt jobsøgningspligt',
             '1. Læs brevet i digital post og notér frist for bemærkninger.' || E'\n' || '2. Indsend dokumentation for sygdom, møde eller teknisk fejl.' || E'\n' || '3. Anmod om genoptagelse eller klage efter vejledning i brevet.' || E'\n' || '4. Kontakt a-kasse og jobcenter for at afklare registrering.',
             'Joblog, aktivering, a-kasse'),
            ('KB-2026-00045', 'Uddannelse og opkvalificering via jobcenter', 'published', ARRAY['uddannelse', 'opkvalificering', 'jobcenter', 'aktivering']::varchar[],
             'Muligheder for kurser, AMU og uddannelse som led i aktiveringsplan.',
             '- Vil i gang med efteruddannelse' || E'\n' || '- Usikker på om uddannelse stopper ydelse',
             '1. Drøft ønske med sagsbehandler — uddannelse skal ofte godkendes.' || E'\n' || '2. Tjek om ordningen er jobrettet og i planen.' || E'\n' || '3. A-kasse kan have særskilte regler for dimittender.' || E'\n' || '4. Dokumentér deltagelse og fremmøde.',
             'Aktivering, dagpenge, CV'),
            ('KB-2026-00046', 'Fleksjob og førtidspension — henvisning og første skridt', 'published', ARRAY['fleksjob', 'førtidspension', 'borger', 'jobcenter']::varchar[],
             'Overblik over processer ved nedsat arbejdsevne — ikke afgørelse af ret.',
             '- Kan ikke fastholde fuld tid på arbejdsmarkedet' || E'\n' || '- Læge har anbefalet fleksjob',
             '1. Kontakt jobcenter for vurdering af arbejdsevne og mulige ordninger.' || E'\n' || '2. Indhent dokumentation fra læge og evt. arbejdsgiver.' || E'\n' || '3. Førtidspension behandles af anden instans — jobcenter vejleder om overgang.' || E'\n' || '4. Bevar dialog om aktivering indtil afgørelse foreligger.',
             'Sygedagpenge, aktivering, GDPR'),
            ('KB-2026-00047', 'Dækning af udgifter ved arbejdspraktik og løntilskud', 'published', ARRAY['løntilskud', 'praktik', 'jobcenter', 'økonomi']::varchar[],
             'Generel info om løntilskud og udgifter i forbindelse med praktik og virksomhedsordninger.',
             '- Usikker på løn under praktik' || E'\n' || '- Virksomhed spørger om tilskud',
             '1. Aftale indgås mellem jobcenter og virksomhed — borger får orientering.' || E'\n' || '2. Spørgsmål om beløb rettes til sagsbehandler.' || E'\n' || '3. Indberet timer og fravær korrekt i joblog.' || E'\n' || '4. Gem aftaledokument i digital post.',
             'Virksomhedspraktik, transport, aktivering'),
            ('KB-2026-00048', 'Flytning og skift af jobcenter', 'published', ARRAY['flytning', 'jobcenter', 'borger', 'selvbetjening']::varchar[],
             'Hvad du gør ved adresseændring og overgang til nyt jobcenter.',
             '- Stadig tildelt gammelt jobcenter' || E'\n' || '- Møde i forkert kommune',
             '1. Opdater adresse i Folkeregisteret (borger.dk).' || E'\n' || '2. Vent på automatisk overflytning eller kontakt nyt jobcenter.' || E'\n' || '3. Læs digital post om ny sagsbehandler.' || E'\n' || '4. Fortsæt joblog indtil system viser ny periode/afdeling.',
             'Digital post, åbningstider, a-kasse'),
            ('KB-2026-00049', 'Faglig vurdering ved langvarig ledighed (kladde)', 'draft', ARRAY['vurdering', 'langtidsledig', 'kladde', 'jobcenter']::varchar[],
             'Kommende artikel om faglig vurdering og indhold i samtaleforløb.',
             '- Modtaget indkaldelse uden forklaring' || E'\n' || '- Usikker på konsekvenser',
             '1. Mød op med CV og joblog-udtræk.' || E'\n' || '2. Forbered beskrivelse af jobsøgning siden sidste møde.' || E'\n' || '3. Artikel færdiggøres — kontakt jobcenter ved akutte spørgsmål.',
             'Aktivering, rådighed'),
            ('KB-2026-00050', 'Integration og danskuddannelse — overblik (kladde)', 'draft', ARRAY['integration', 'dansk', 'kladde', 'jobcenter']::varchar[],
             'Kladde om danskuddannelse og jobcenterets rolle for nye borgere.',
             '- Usikker på ret til gratis dansk' || E'\n' || '- Kombination af job og skole',
             '1. Kontakt jobcenter for henvisning til uddannelsessted.' || E'\n' || '2. Afklar om aktivering kan kombineres med dansk.' || E'\n' || '3. Afvent endelig artikel.',
             'Aktivering, uddannelse'),
            ('KB-2026-00051', 'Skift af sagsbehandler og ventetid (kladde)', 'draft', ARRAY['sagsbehandler', 'ventetid', 'kladde', 'jobcenter']::varchar[],
             'Kladde om forventninger ved sagsbehandlerskift og svar på henvendelser.',
             '- Ny sagsbehandler kender ikke min sag' || E'\n' || '- Ingen tilbagekaldelse',
             '1. Send kort status via digital post.' || E'\n' || '2. Ved akut — ring til jobcenter hovednummer.' || E'\n' || '3. Artikel opdateres med SLA-tekster.',
             'Kontakt STAR, digital post'),
            ('KB-2026-00052', 'Ny STAR-portal — kommende funktioner (kladde)', 'draft', ARRAY['star', 'portal', 'kladde', 'selvbetjening']::varchar[],
             'Preview af kommende selvbetjeningsfunktioner — ikke produktionsvejledning.',
             '- Hørt om ny portal i medierne' || E'\n' || '- Gammel bookmark virker ikke',
             '1. Brug stadig nuværende login på star.dk.' || E'\n' || '2. Følg officielle meddelelser i digital post.' || E'\n' || '3. Kladde — fuld guide publiceres ved lancering.',
             'MitID, browser'),
            ('KB-2026-00053', 'Udbetaling af dagpenge ved it-fejl (kladde)', 'draft', ARRAY['dagpenge', 'udbetaling', 'kladde', 'a-kasse']::varchar[],
             'Kladde om manuelle udbetalinger når selvbetjening eller a-kasse-system fejler.',
             '- Udbetaling mangler trods godkendt periode' || E'\n' || '- Systemfejl hos a-kasse',
             '1. Kontakt a-kasse med periode og sagsnummer.' || E'\n' || '2. Gem fejlbeskeder og skærmbilleder.' || E'\n' || '3. Afvent endelig procedure i denne artikel.',
             'A-kasse, joblog, digital post'),
            ('KB-2026-00054', 'Samarbejde kommune og a-kasse — tværgående sager (kladde)', 'draft', ARRAY['kommune', 'a-kasse', 'kladde', 'borger']::varchar[],
             'Kladde der forklarer roller når både kommune og a-kasse er involveret.',
             '- To myndigheder giver forskellige svar' || E'\n' || '- Usikker hvem der udbetaler',
             '1. Notér sagsnumre hos begge parter.' || E'\n' || '2. Bed om fælles samtale hvis muligt.' || E'\n' || '3. Artikel udvides med caseskema.',
             'Dagpenge, økonomisk hjælp'),
            ('KB-2026-00055', 'Borgerhotline sygedagpenge 2026 (kladde)', 'draft', ARRAY['sygedagpenge', 'hotline', 'kladde', 'star']::varchar[],
             'Kladde om dedikeret hotline og åbningstider for sygedagpenge-spørgsmål.',
             '- Skal bruge telefonnummer før artikel er klar' || E'\n' || '- Ventetid ukendt',
             '1. Se star.dk for opdaterede numre ved lancering.' || E'\n' || '2. Indtil da — kontakt a-kasse eller jobcenter.' || E'\n' || '3. Denne artikel publiceres når hotline er live.',
             'Sygedagpenge, kontakt STAR')
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

    RAISE NOTICE 'Seeded 35 knowledge articles (KB-2026-00021..00055)';
END $$;
