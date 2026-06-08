export type Kp2FormCategory =
  | "adgang-brugere"
  | "data"
  | "fejl-aendringer"
  | "generelt";

export type Kp2FormFieldType =
  | "text"
  | "textarea"
  | "select"
  | "checkbox"
  | "datetime"
  | "tags";

export type Kp2FormField = {
  name: string;
  label: string;
  type: Kp2FormFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  showWhen?: { field: string; values: string[] };
  link?: { href: string; label: string };
};

export type Kp2FormSchema = {
  id: string;
  title: string;
  category: Kp2FormCategory;
  icon: string;
  helpText: string;
  fields: Kp2FormField[];
  attachments?: boolean;
  gdprNote?: string;
  submitLabel?: string;
  onBehalfOf?: boolean;
};

export type Kp2Tile = {
  id: string;
  title: string;
  href: string;
  icon: string;
  featured?: boolean;
};

export type Kp2ServiceMessageUpdate = {
  id: string;
  author: string;
  createdAt: string;
  body: string;
};

export type Kp2ServiceMessage = {
  id: string;
  title: string;
  summary: string;
  status: "behandler" | "loest" | "planlagt";
  type: string;
  categorization: string;
  registeredAt: string;
  updates: Kp2ServiceMessageUpdate[];
};

export type Kp2CaseRow = {
  id: string;
  number: string;
  title: string;
  type: "incident" | "service_request" | "change";
  status: string;
  priority: string;
  createdAt: string;
  requester: string;
};

export type Kp2MonthlyStatRow = {
  period: string;
  registeredSecondLine: number;
  resolvedSecondLine: number;
};

export const KP2_CATEGORY_LABELS: Record<Kp2FormCategory, string> = {
  "adgang-brugere": "Adgang & brugere",
  data: "Data",
  "fejl-aendringer": "Fejl & aendringer",
  generelt: "Generelt",
};

export const KP2_BASE = "/kundeportal-2";
