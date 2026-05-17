/** Prototype demo logins — keep in sync with docs/seed-sf-ecosystem-reset.sql */

export const DEMO_PASSWORD = "Stardesk2026!";

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
  admin("sf01@example.dk", "SF Topadmin Anna", "Topadministrator"),
  admin("sf02@example.dk", "SF Admin Bo"),
  admin("sf03@example.dk", "SF Admin Clara"),
  agent("estrifft01@example.dk", "Es Trifft Agent 1", "Es Trifft"),
  agent("estrifft02@example.dk", "Es Trifft Agent 2", "Es Trifft"),
  agent("estrifft03@example.dk", "Es Trifft Agent 3", "Es Trifft"),
  agent("sfchest01@example.dk", "SF Chest Agent 1", "SF Chest"),
  agent("sfchest02@example.dk", "SF Chest Agent 2", "SF Chest"),
  agent("sfchest03@example.dk", "SF Chest Agent 3", "SF Chest"),
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
    "Es Trifft",
    "SF Chest",
    "North Star",
    "Jobflow",
    "Sirius",
    "BI",
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
