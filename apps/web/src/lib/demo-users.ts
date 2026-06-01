/** Prototype demo logins — keep in sync with docs/seed-sf-ecosystem-reset.sql */

/** Prototype-only; set NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD in dev/test env. */
export const DEMO_PASSWORD = // NOSONAR typescript:S2068 — from env, prototype demo only
  process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD?.trim() ?? "";

export type DemoUser = {
  email: string;
  password: string;
  roleLabel: string;
  group: string;
  displayName: string;
};

const EXCLUDED_EMAILS = new Set(["larrysanders@example.dk"]);

function agent(
  email: string,
  displayName: string,
  group: string,
): DemoUser {
  return {
    email,
    password: DEMO_PASSWORD,
    roleLabel: "Agent",
    group,
    displayName,
  };
}

function admin(email: string, displayName: string, roleLabel = "Administrator"): DemoUser {
  return {
    email,
    password: DEMO_PASSWORD,
    roleLabel,
    group: "SF (alle sager)",
    displayName,
  };
}

const RAW_DEMO_USERS: DemoUser[] = [
  {
    email: "submitter@example.dk",
    password: DEMO_PASSWORD,
    roleLabel: "Indmelder",
    group: "Self-service",
    displayName: "Anders Submitter",
  },
  admin("sf01@example.dk", "Anna", "Topadministrator"),
  admin("sf02@example.dk", "Bo"),
  admin("sf03@example.dk", "Clara"),
  agent("sfchest01@example.dk", "SF Operations Agent 1", "SF Operations"),
  agent("sfchest02@example.dk", "SF Operations Agent 2", "SF Operations"),
  agent("sfchest03@example.dk", "SF Operations Agent 3", "SF Operations"),
  agent("estrifft01@example.dk", "Virksomhed Agent 1", "Virksomhed"),
  agent("estrifft02@example.dk", "Virksomhed Agent 2", "Virksomhed"),
  agent("estrifft03@example.dk", "Virksomhed Agent 3", "Virksomhed"),
  agent("northstar01@example.dk", "North Star Agent 1", "North Star"),
  agent("northstar02@example.dk", "North Star Agent 2", "North Star"),
  agent("northstar03@example.dk", "North Star Agent 3", "North Star"),
  agent("jobflow01@example.dk", "Jobflow Agent 1", "Jobflow"),
  agent("jobflow02@example.dk", "Jobflow Agent 2", "Jobflow"),
  agent("jobflow03@example.dk", "Jobflow Agent 3", "Jobflow"),
  agent("sirius01@example.dk", "Sirius Agent 1", "Sirius"),
  agent("sirius02@example.dk", "Sirius Agent 2", "Sirius"),
  agent("sirius03@example.dk", "Sirius Agent 3", "Sirius"),
  agent("bi01@example.dk", "BI Agent 1", "BI"),
  agent("bi02@example.dk", "BI Agent 2", "BI"),
  agent("bi03@example.dk", "BI Agent 3", "BI"),
  agent("kmd01@example.dk", "KMD Agent 1", "KMD"),
  agent("kmd02@example.dk", "KMD Agent 2", "KMD"),
  agent("kmd03@example.dk", "KMD Agent 3", "KMD"),
  agent("netcompany01@example.dk", "Netcompany Agent 1", "Netcompany"),
  agent("netcompany02@example.dk", "Netcompany Agent 2", "Netcompany"),
  agent("netcompany03@example.dk", "Netcompany Agent 3", "Netcompany"),
  agent("schultz01@example.dk", "Schultz Agent 1", "Schultz"),
  agent("schultz02@example.dk", "Schultz Agent 2", "Schultz"),
  agent("schultz03@example.dk", "Schultz Agent 3", "Schultz"),
];

export const DEMO_USERS = RAW_DEMO_USERS.filter((u) => !EXCLUDED_EMAILS.has(u.email));

export type DemoUserGroup = {
  title: string;
  users: DemoUser[];
};

export function groupDemoUsers(users: DemoUser[] = DEMO_USERS): DemoUserGroup[] {
  const order = [
    "Self-service",
    "SF (alle sager)",
    "Virksomhed",
    "North Star",
    "SF Operations",
    "SF AI Operations",
    "Jobflow",
    "Sirius",
    "BI",
    "KMD",
    "Netcompany",
    "Schultz",
  ];
  const map = new Map<string, DemoUser[]>();
  for (const user of users) {
    const list = map.get(user.group) ?? [];
    list.push(user);
    map.set(user.group, list);
  }
  return order
    .filter((title) => map.has(title))
    .map((title) => ({ title, users: map.get(title) ?? [] }));
}
