import type { Kp2FormSchema } from "@/lib/kundeportal-2/types";

export const KP2_PRIORITY_OPTIONS = [
  "1 - Kritisk",
  "2 - Høj",
  "3 - Ikke kritisk",
  "4 - Lav",
];

export const KP2_ENVIRONMENT_OPTIONS = [
  "Produktion",
  "Test (T1)",
  "Test (T2)",
  "Test (T3)",
  "Uddannelse",
  "Ikke relevant",
];

export const KP2_RELEASE_OPTIONS = [
  "Ikke relevant",
  "2025-1",
  "2025-2",
  "2025-3",
  "2025-4",
  "Nyt Jobnet",
];

export const KP2_FORM_SCHEMAS: Kp2FormSchema[] = [
  {
    id: "opret-borger",
    title: "Opret borger",
    category: "adgang-brugere",
    icon: "user-plus",
    helpText:
      "Brug denne formular til at oprette en borger i et miljø. Angiv tydelig identifikation og begrundelse.",
    gdprNote:
      "Persondata behandles i overensstemmelse med GDPR og STARs databehandleraftale.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      {
        name: "miljo",
        label: "Miljø",
        type: "select",
        required: true,
        options: KP2_ENVIRONMENT_OPTIONS,
      },
      {
        name: "identifikation",
        label: "Identifikation",
        type: "textarea",
        required: true,
        helpText: "CPR, sag-ID eller anden entydig identifikation.",
      },
      {
        name: "begrundelse",
        label: "Begrundelse",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "nulstil-kodeord",
    title: "Nulstil kodeord",
    category: "adgang-brugere",
    icon: "key",
    helpText: "Anmod om nulstilling af adgangskode for en bruger.",
    attachments: false,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "bruger", label: "Bruger (navn eller e-mail)", type: "text", required: true },
      { name: "system", label: "System", type: "text", required: true },
      { name: "begrundelse", label: "Begrundelse", type: "textarea", required: true },
    ],
  },
  {
    id: "datagenopretning",
    title: "Datagenopretning",
    category: "data",
    icon: "database",
    helpText:
      "Anmod om genoprettelse af data. Ved persondata: se særlige overvejelser.",
    gdprNote: "Ved persondata gælder særlige krav til dokumentation og godkendelse.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      {
        name: "prioritet",
        label: "Prioritet",
        type: "select",
        required: true,
        options: KP2_PRIORITY_OPTIONS,
        defaultValue: "3 - Ikke kritisk",
        link: { href: "#", label: "Særlige overvejelser for persondata" },
      },
      {
        name: "miljo",
        label: "Miljø",
        type: "select",
        required: true,
        options: KP2_ENVIRONMENT_OPTIONS,
        defaultValue: "Produktion",
      },
      { name: "identifikation", label: "Identifikation / persondata", type: "textarea", required: true },
      { name: "beskrivelse", label: "Detaljeret beskrivelse", type: "textarea", required: true },
      { name: "tags", label: "Mine tags", type: "tags" },
    ],
  },
  {
    id: "fejl-produktion",
    title: "Fejl Produktion",
    category: "fejl-aendringer",
    icon: "alert-circle",
    helpText: "Indrapporter fejl i produktionsmiljø. Beskriv impact og forretningskritikalitet.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "beskrivelse", label: "Detaljeret beskrivelse", type: "textarea", required: true },
      {
        name: "prioritet",
        label: "Prioritet",
        type: "select",
        required: true,
        options: KP2_PRIORITY_OPTIONS,
        link: { href: "#", label: "Information om STARs prioriteter" },
      },
      {
        name: "miljo",
        label: "Miljø",
        type: "select",
        required: true,
        options: ["Produktion"],
        defaultValue: "Produktion",
      },
      { name: "system", label: "System", type: "text", required: true },
      { name: "tags", label: "Mine tags", type: "tags" },
    ],
  },
  {
    id: "fejl-testmiljo",
    title: "Fejl testmiljø",
    category: "fejl-aendringer",
    icon: "bug",
    helpText:
      "Indrapporter fejl i testmiljø. Opret én sag pr. miljø hvis fejlen gælder flere miljøer.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "beskrivelse", label: "Detaljeret beskrivelse", type: "textarea", required: true },
      {
        name: "prioritet",
        label: "Prioritet",
        type: "select",
        required: true,
        options: KP2_PRIORITY_OPTIONS,
        link: { href: "#", label: "Information om STARs prioriteter" },
      },
      { name: "observeret", label: "Forventet vs. observeret resultat", type: "textarea" },
      {
        name: "miljo",
        label: "Miljø",
        type: "select",
        required: true,
        options: ["T1", "T2", "T3", "Uddannelse"],
      },
      {
        name: "release",
        label: "Release",
        type: "select",
        required: true,
        options: KP2_RELEASE_OPTIONS,
        showWhen: { field: "miljo", values: ["T1", "T2", "T3"] },
      },
      { name: "epic", label: "Evt. Epic", type: "text" },
      { name: "system", label: "System", type: "text" },
      { name: "tags", label: "Mine tags", type: "tags" },
    ],
  },
  {
    id: "datageksport",
    title: "Datageksport",
    category: "data",
    icon: "download",
    helpText: "Anmod om dataudtræk eller eksport fra et system.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "miljo", label: "Miljø", type: "select", required: true, options: KP2_ENVIRONMENT_OPTIONS },
      { name: "beskrivelse", label: "Hvilke data skal eksporteres?", type: "textarea", required: true },
    ],
  },
  {
    id: "testdata",
    title: "Testdata",
    category: "data",
    icon: "flask",
    helpText: "Anmod om oprettelse eller genoprettelse af testdata.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "miljo", label: "Miljø", type: "select", required: true, options: KP2_ENVIRONMENT_OPTIONS },
      { name: "beskrivelse", label: "Beskrivelse", type: "textarea", required: true },
    ],
  },
  {
    id: "systemadgang",
    title: "Systemadgang",
    category: "adgang-brugere",
    icon: "shield",
    helpText:
      "Bestil systemadgang på egne eller andres vegne. Testmiljø kræver testcertifikat-formular.",
    onBehalfOf: true,
    gdprNote:
      "Bestiller erklærer at brugeren må få adgang i overensstemmelse med databehandleraftalen og fortrolighedsregler.",
    attachments: false,
    fields: [
      {
        name: "titel",
        label: "Titel",
        type: "text",
        required: true,
      },
      {
        name: "prioritet",
        label: "Prioritet",
        type: "select",
        required: true,
        options: KP2_PRIORITY_OPTIONS,
      },
      { name: "navn", label: "Navn", type: "text", required: true },
      { name: "email", label: "E-mail", type: "text", required: true },
      { name: "beskrivelse", label: "Begrundelse / beskrivelse", type: "textarea", required: true },
      {
        name: "miljo",
        label: "Miljø",
        type: "select",
        required: true,
        options: KP2_ENVIRONMENT_OPTIONS,
      },
      { name: "system", label: "Angiv system", type: "text", required: true },
      {
        name: "gdpr_bekraeftelse",
        label:
          "Jeg bekræfter at brugeren må få adgang i overensstemmelse med databehandleraftalen og fortrolighedsregler",
        type: "checkbox",
        required: true,
      },
    ],
  },
  {
    id: "testcertifikat",
    title: "Testcertifikat",
    category: "adgang-brugere",
    icon: "certificate",
    helpText: "Anmod om testcertifikat til adgang i testmiljøer.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "miljo", label: "Miljø", type: "select", required: true, options: ["T1", "T2", "T3"] },
      { name: "beskrivelse", label: "Beskrivelse", type: "textarea", required: true },
    ],
  },
  {
    id: "whitelist-ip",
    title: "Whitelist IP",
    category: "adgang-brugere",
    icon: "globe",
    helpText: "Anmod om whitelisting af IP-adresse.",
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "ip", label: "IP-adresse", type: "text", required: true },
      { name: "miljo", label: "Miljø", type: "select", required: true, options: KP2_ENVIRONMENT_OPTIONS },
      { name: "begrundelse", label: "Begrundelse", type: "textarea", required: true },
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    category: "adgang-brugere",
    icon: "log-in",
    helpText: "Onboard en ny medarbejder eller ressource.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "navn", label: "Navn på ny medarbejder", type: "text", required: true },
      { name: "startdato", label: "Startdato", type: "datetime", required: true },
      { name: "beskrivelse", label: "Behov (adgang, udstyr m.m.)", type: "textarea", required: true },
    ],
  },
  {
    id: "offboarding",
    title: "Offboarding",
    category: "adgang-brugere",
    icon: "log-out",
    helpText: "Offboard en medarbejder — afslut adgange og overdrag opgaver.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "navn", label: "Navn", type: "text", required: true },
      { name: "sidste_dag", label: "Sidste arbejdsdag", type: "datetime", required: true },
      { name: "beskrivelse", label: "Beskrivelse", type: "textarea", required: true },
    ],
  },
  {
    id: "aendring",
    title: "Ændring",
    category: "fejl-aendringer",
    icon: "git-branch",
    helpText: "Anmod om en ændring (change request).",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      {
        name: "prioritet",
        label: "Prioritet",
        type: "select",
        required: true,
        options: KP2_PRIORITY_OPTIONS,
      },
      { name: "beskrivelse", label: "Detaljeret beskrivelse", type: "textarea", required: true },
      { name: "miljo", label: "Miljø", type: "select", options: KP2_ENVIRONMENT_OPTIONS },
      { name: "tags", label: "Mine tags", type: "tags" },
    ],
  },
  {
    id: "sporgsmaal",
    title: "Spørgsmål",
    category: "generelt",
    icon: "help-circle",
    helpText: "Stil et generelt spørgsmål til IT Operations.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      {
        name: "prioritet",
        label: "Prioritet",
        type: "select",
        required: true,
        options: KP2_PRIORITY_OPTIONS,
        link: { href: "#", label: "Link til STAR Wiki: Prioritetsoversigt" },
      },
      {
        name: "miljo",
        label: "Evt. Miljø",
        type: "select",
        options: KP2_ENVIRONMENT_OPTIONS,
        defaultValue: "Ikke relevant",
      },
      { name: "epic", label: "Evt. Epic", type: "text" },
      {
        name: "release",
        label: "Evt. Release",
        type: "select",
        options: KP2_RELEASE_OPTIONS,
        defaultValue: "Ikke relevant",
      },
      { name: "beskrivelse", label: "Detaljeret beskrivelse", type: "textarea", required: true },
      { name: "tags", label: "Mine tags", type: "tags" },
    ],
  },
  {
    id: "eksterne-testcases",
    title: "Eksterne testcases",
    category: "fejl-aendringer",
    icon: "table",
    helpText: "Opret eller registrer eksterne testcases for et miljø.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "miljo", label: "Miljø", type: "select", required: true, options: KP2_ENVIRONMENT_OPTIONS },
      { name: "beskrivelse", label: "Beskrivelse", type: "textarea", required: true },
    ],
  },
  {
    id: "fejlbearbejdning-eksterne",
    title: "Fejlbearbejdning eksterne",
    category: "fejl-aendringer",
    icon: "users",
    helpText: "Behandle fejl indmeldt af eksterne parter.",
    attachments: true,
    fields: [
      { name: "titel", label: "Titel", type: "text", required: true },
      { name: "beskrivelse", label: "Detaljeret beskrivelse", type: "textarea", required: true },
      {
        name: "prioritet",
        label: "Prioritet",
        type: "select",
        required: true,
        options: KP2_PRIORITY_OPTIONS,
      },
    ],
  },
];

export function getKp2FormSchema(id: string): Kp2FormSchema | undefined {
  return KP2_FORM_SCHEMAS.find((s) => s.id === id);
}

export function getKp2FormsByCategory() {
  const grouped = new Map<string, Kp2FormSchema[]>();
  for (const schema of KP2_FORM_SCHEMAS) {
    const list = grouped.get(schema.category) ?? [];
    list.push(schema);
    grouped.set(schema.category, list);
  }
  return grouped;
}
