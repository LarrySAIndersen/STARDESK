import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  H1,
  IconButton,
  Row,
  Stack,
  Text,
  TextArea,
  TextInput,
  Checkbox,
  CollapsibleSection,
  useCanvasAction,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type ReviewVerificationScope = "stardesk" | "cursor" | "none";

type Priority = "P0" | "P1" | "P2" | "P3";
type Status =
  | "Bobler"
  | "Backlog"
  | "Refinement"
  | "Ready"
  | "In Progress"
  | "Review"
  | "Human Review"
  | "Done"
  | "Archived";

type Task = {
  id: string;
  number: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  owner: string;
  tags: string;
  source: string;
  parentId?: string;
  createdAt?: number;
  /** Review afvist — agent skal genkøre med agentRerunReason. */
  agentRerunRequired?: boolean;
  agentRerunReason?: string;
  agentRerunAt?: number;
  /** Vises øverst i sag-detalje når status Review — agent udfylder ved afslutning. */
  reviewDeliveryHeading?: string;
  reviewDeliverySummary?: string;
  reviewDeliveryAt?: number;
  /** Deployed STARDESK URL where reviewer can manually verify the change. */
  reviewVerificationUrl?: string;
  /** Short Danish label for the verification link (optional). */
  reviewVerificationLabel?: string;
  /** Where reviewer verifies: deployed STARDESK, this canvas, or hidden. */
  reviewVerificationScope?: ReviewVerificationScope;
  /** Review-forberedelse (før Review) — kasse nederst i åben sag; review-agent udfylder. */
  reviewPrepHeading?: string;
  reviewPrepSummary?: string;
  reviewPrepSkills?: string[];
  reviewPrepReviewer?: string;
  reviewPrepAt?: number;
  reviewPrepAgentStartedAt?: number;
  reviewDeliveryActor?: ActivityActor;
  reviewPrepActor?: ActivityActor;
  /** Plan Cursor agent wrote before/during implementation. */
  agentPlan?: string;
  agentPlanAt?: number;
  agentPlanActor?: ActivityActor;
  /** Kronologisk log: dato/tid + aktør (Dig eller Agent) + handling. */
  activityLog?: TaskActivityEntry[];
  /** Per-field version snapshots when tracked text fields change. */
  fieldHistory?: FieldHistory;
  /** Ms timestamp when task entered Done (set on godkendelse). Used for auto-archive after 1h. */
  doneAt?: number;
  /** Vedhæftninger ved Review-afvisning (billeder + video, base64 data URLs). */
  reviewRejectAttachments?: ReviewRejectAttachment[];
  /** @deprecated Brug reviewRejectAttachments — beholdt for ældre afvisninger. */
  reviewRejectImages?: ReviewRejectImage[];
  /** Automatisk Playwright-smoke efter skift til Review (ekstern runner udfylder). */
  reviewPlaywrightEvidence?: ReviewPlaywrightEvidence;
  /** Agent Review auto-verifikation (Cursor agent / subagents udfylder). */
  agentReviewEvidence?: AgentReviewEvidence;
  /** Human-readable verification plan + results (synced from agentReviewEvidence). */
  agentReviewView?: string;
  agentReviewViewAt?: number;
  agentReviewViewActor?: ActivityActor;
  /** Ms when Agent Review chat was auto-started from Work Board. */
  agentReviewAgentStartedAt?: number;
  /** Ms when upstream pipeline agents were auto-started. */
  kodeklarAgentStartedAt?: number;
  refinementAgentStartedAt?: number;
  readyAgentStartedAt?: number;
  /** Kanban-rækkefølge inden for status (persistes i DB extra). */
  boardIndex?: number;
};

type ReviewPlaywrightScreenshot = {
  id: string;
  caption: string;
  dataUrl: string;
};

type ReviewPlaywrightEvidence = {
  at: number;
  actor: "agent";
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  username?: string;
  verificationUrl?: string;
  log: string;
  screenshots: ReviewPlaywrightScreenshot[];
};

type AgentReviewEvidenceMethod =
  | "playwright"
  | "agent"
  | "code"
  | "canvas"
  | "hybrid"
  | "manual";

type AcceptCriterionCategory = "functional" | "technical";

type AcceptCriterionReviewStatus = "pending" | "passed" | "failed" | "skipped";

type AcceptCriterionReview = {
  id: string;
  text: string;
  category: AcceptCriterionCategory;
  status: AcceptCriterionReviewStatus;
  /** How verified: playwright, kode, canvas, manuelt, hybrid */
  method?: string;
  note?: string;
};

type AgentReviewEvidence = {
  at: number;
  actor: "agent";
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  method: AgentReviewEvidenceMethod;
  summary?: string;
  /** Danish handoff text for Jan in Human Review. */
  humanReviewHandoff?: string;
  verifiedAt?: number;
  findings?: string[];
  subagentMethods?: AgentReviewEvidenceMethod[];
  /** One row per accept criterion from spec — review-agent fills before passed/failed. */
  acceptCriteria?: AcceptCriterionReview[];
};

type AgentReviewVerificationGate = {
  blocked: boolean;
  warn: boolean;
  message: string | null;
};

/** Block Send til Human Review when agent review failed. */
const AGENT_REVIEW_BLOCK_HUMAN_ON_FAILED = true;
/** Block Send til Human Review while agent review pending/running. */
const AGENT_REVIEW_BLOCK_HUMAN_ON_PENDING = true;
/** Auto-move Review → Human Review when agentReviewEvidence.status is passed. */
const AGENT_REVIEW_AUTO_HUMAN_ON_PASSED = true;

type ReviewRejectAttachmentKind = "image" | "video";

type ReviewRejectAttachment = {
  id: string;
  kind: ReviewRejectAttachmentKind;
  dataUrl: string;
  name: string;
  at: number;
};

/** Legacy — mangler kind; behandles som image. */
type ReviewRejectImage = {
  id: string;
  dataUrl: string;
  name: string;
  at: number;
};

type ActivityActor = "user" | "agent";

type FieldVersion = {
  at: number;
  actor: ActivityActor;
  value: string;
  note?: string;
};

type TrackedFieldKey =
  | "description"
  | "reviewDeliverySummary"
  | "reviewPrepSummary"
  | "agentPlan"
  | "agentReviewView";

type FieldHistory = {
  description?: FieldVersion[];
  reviewDeliverySummary?: FieldVersion[];
  reviewPrepSummary?: FieldVersion[];
  agentPlan?: FieldVersion[];
  agentReviewView?: FieldVersion[];
};

type TaskActivityEntry = {
  at: number;
  actor: ActivityActor;
  action: string;
  detail?: string;
};

const FIELD_HISTORY_LIMIT = 50;

const TRACKED_FIELD_KEYS = [
  "description",
  "agentPlan",
  "reviewDeliverySummary",
  "reviewPrepSummary",
  "agentReviewView",
] as const satisfies readonly TrackedFieldKey[];

const AGENT_REVIEW_VIEW_PLAN_MARKER = "Sådan verificeres:";
const AGENT_REVIEW_VIEW_DONE_MARKER = "Verificeret:";
const GENERIC_DELIVERY_HEADINGS = new Set(["Leverance til review", "Leverance til Review"]);

const ACTOR_LABEL_DA: Record<ActivityActor, string> = {
  user: "Dig",
  agent: "Agent",
};

type ReviewSkillEntry = {
  id: string;
  label: string;
  path: string;
  keywords: string[];
};

type ReviewerEntry = {
  id: string;
  label: string;
  focus: string;
  keywords: string[];
};

const REVIEW_SKILL_CATALOG: ReviewSkillEntry[] = [
  {
    id: "stardesk-portal-usability",
    label: "Portal-selvbetjening (borger-UX)",
    path: ".cursor/skills/stardesk-portal-usability/SKILL.md",
    keywords: ["portal", "borger", "selvbetjening", "ticket", "knowledge"],
  },
  {
    id: "react-best-practices",
    label: "React / TSX kvalitet",
    path: ".cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/react-best-practices/SKILL.md",
    keywords: ["tsx", "react", "ui", "layout", "sidebar", "nav", "canvas", "component"],
  },
  {
    id: "nextjs",
    label: "Next.js App Router",
    path: ".cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/nextjs/SKILL.md",
    keywords: ["next", "route", "app router", "middleware", "page"],
  },
  {
    id: "auth",
    label: "Authentication",
    path: ".cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/auth/SKILL.md",
    keywords: ["auth", "login", "keycloak", "session", "middleware"],
  },
  {
    id: "verification",
    label: "E2E-verifikation",
    path: ".cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/verification/SKILL.md",
    keywords: ["test", "e2e", "playwright", "verify", "flow"],
  },
  {
    id: "render-deploy",
    label: "Render deploy / drift",
    path: ".cursor/plugins/cache/cursor-public/render/c7a2b59cbc1c2b4d95a88e01c229a3898405dbd6/skills/render-deploy/SKILL.md",
    keywords: ["render", "deploy", "ops", "restore", "preprod", "miljø"],
  },
  {
    id: "canvas",
    label: "Cursor Canvas",
    path: ".cursor/skills-cursor/canvas/SKILL.md",
    keywords: ["canvas", "workboard", "kanban"],
  },
  {
    id: "stardesk-workboard-review-prep",
    label: "Work Board review-forberedelse",
    path: ".cursor/skills/stardesk-workboard-review-prep/SKILL.md",
    keywords: ["workboard", "review", "agent", "kanban", "prep"],
  },
  {
    id: "stardesk-agent-review",
    label: "Agent Review-verifikation",
    path: "STARDESK/.cursor/skills/stardesk-agent-review/SKILL.md",
    keywords: ["workboard", "review", "agent", "playwright", "verify", "human review"],
  },
];

const REVIEWER_CATALOG: ReviewerEntry[] = [
  {
    id: "ux-borger",
    label: "UX — borger og portal",
    focus: "Læsbarhed, flows, dansk copy, tilgængelighed i selvbetjening.",
    keywords: ["portal", "borger", "ux", "usability", "copy"],
  },
  {
    id: "frontend",
    label: "Frontend — layout og komponenter",
    focus: "React/TSX, responsivt layout, ingen regression i UI.",
    keywords: ["ui", "layout", "sidebar", "nav", "resize", "tsx", "react"],
  },
  {
    id: "security-gdpr",
    label: "Sikkerhed og GDPR",
    focus: "CPR, maskering, auth, data minimization.",
    keywords: ["gdpr", "cpr", "sikkerhed", "security", "auth"],
  },
  {
    id: "ops",
    label: "Drift og integration",
    focus: "Deploy, miljø, restore, eksterne integrationer.",
    keywords: ["render", "deploy", "restore", "preprod", "n8n", "sonar", "slack", "jira"],
  },
  {
    id: "fullstack",
    label: "Fullstack STARdesk",
    focus: "Generel gennemgang af spec, acceptkriterier og helhed.",
    keywords: [],
  },
];

const REVIEW_REJECT_IMAGE_MAX_BYTES = 500 * 1024;
const REVIEW_REJECT_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const REVIEW_REJECT_IMAGE_MAX_COUNT = 3;
const REVIEW_REJECT_VIDEO_MAX_COUNT = 2;
const REVIEW_REJECT_FILE_INPUT_ID = "stardesk-review-reject-file-input";
const REVIEW_REJECT_FILE_ACCEPT =
  "image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

const REVIEW_REJECTED_MARKER = "--- Review afvist ---";
const AGENT_RERUN_MARKER = "--- AGENT GENKØRSEL PÅKRÆVET ---";
const REVIEW_DELIVERY_MARKER = "--- Review leverance ---";
const REVIEW_DELIVERY_MIN_SUMMARY_LEN = 80;
const AGENT_PLAN_MIN_LEN = 80;
const GENERIC_REVIEW_DELIVERY_HEADINGS = new Set(["Leverance til review", "Leverance"]);
const REVIEW_DELIVERY_REQUIRED_MESSAGE =
  "Leverance skal beskrive konkret gennemført arbejde (min. 80 tegn, ingen «Planlagt leverance») før Agent Review.";
const REVIEW_DELIVERY_GENERIC_MESSAGE =
  "Leverance er for generisk — beskriv hvad der er lavet: filer, funktioner og hvordan det verificeres.";
const AGENT_PLAN_REQUIRED_MESSAGE =
  "Agent-plan skal beskrive konkrete implementeringstrin (min. 80 tegn) før flyt til Agent Review.";
const KODEKLAR_SPEC_REQUIRED_MESSAGE =
  "Kodningsklar spec mangler (--- Kodningsklar spec ---) — start kodeklar-agent eller udfyld beskrivelsen før Refinement.";
const REFINEMENT_TO_READY_MESSAGE =
  "Agent-plan skal beskrive konkrete implementeringstrin (min. 80 tegn) før flyt til Ready.";
const READY_TO_IN_PROGRESS_MESSAGE =
  "Kodningsklar spec og agent-plan (min. 80 tegn) kræves før I gang.";
const SKIP_PIPELINE_TO_IN_PROGRESS_MESSAGE =
  "Hårdt krav: opgaven skal gennem Refinement og Ready før I gang.";
const SKIP_REFINEMENT_MESSAGE =
  "Flyt først til Refinement — plan-agent skriver agentPlan der.";
const UPSTREAM_TO_REVIEW_MESSAGE =
  "Opgaven skal implementeres (I gang) før Agent Review.";

/** Columns where new work enters the upstream pipeline. */
const PIPELINE_START_STATUSES: Status[] = ["Bobler", "Backlog"];

function isPipelineStartStatus(status: Status): boolean {
  return PIPELINE_START_STATUSES.includes(status);
}

function hasKodeklarSpec(task: Task): boolean {
  return task.description.includes(SPEC_MARKER);
}

function hasReadyToImplement(task: Task, draftPlan?: string): boolean {
  return hasKodeklarSpec(task) && hasAgentPlanReady(task, draftPlan);
}

const COLUMN_WORKFLOW_HINTS: Partial<Record<Status, string>> = {
  Bobler: "Ny idé → Start workflow: kodeklar-agent udfylder spec → Refinement",
  Backlog: "Prioriteret → Start workflow eller træk til Refinement når spec er klar",
  Refinement: "Plan-agent skriver agentPlan (min. 80 tegn) → Ready",
  Ready: "Spec + plan klar → I gang (implementerings-agent)",
  "In Progress": "Agent bygger — afslut med leverance → Agent Review",
  Done: "Godkendte opgaver — arkiveres automatisk efter 1 time",
  Archived: "Lukkede opgaver — historik og reference",
};

const REVIEW_STAGE_HINTS = {
  agent:
    "LEVERANCE = hvad der er bygget (Jan-sprog, adfærd/UI). AGENT VIEW = verifikation mod hvert acceptkriterium (funktionelt + teknisk + Playwright ved stardesk).",
  human:
    "Læs leverance (hvad) og agent view (AC-matrix + handoff). Godkend → Done. Afvis → I gang.",
} as const;

const REVIEW_DELIVERY_JAN_GUIDE =
  "Skriv til Jan: hvad kan han se/prøve i UI (ikke filnavne). Tekniske detaljer hører til agent view / acceptkriterier.";

function getColumnWorkflowHint(column: Status): string | null {
  if (column === "Review") return REVIEW_STAGE_HINTS.agent;
  if (column === "Human Review") return REVIEW_STAGE_HINTS.human;
  return COLUMN_WORKFLOW_HINTS[column] ?? null;
}

function ColumnWorkflowHintBox({
  theme,
  hint,
}: {
  theme: ReturnType<typeof useHostTheme>;
  hint: string;
}) {
  return (
    <div
      style={{
        margin: "0 12px 8px",
        padding: "8px 12px",
        borderBottom: `1px dashed ${theme.stroke.tertiary}`,
        background: theme.fill.secondary,
      }}
    >
      <Text size="small" tone="tertiary" style={{ display: "block", lineHeight: 1.45 }}>
        {hint}
      </Text>
    </div>
  );
}
function isAgentReviewStatus(status: Status): boolean {
  return status === "Review";
}

function isHumanReviewStatus(status: Status): boolean {
  return status === "Human Review";
}

function isAnyReviewColumnStatus(status: Status): boolean {
  return isAgentReviewStatus(status) || isHumanReviewStatus(status);
}

const SPEC_MARKER = "--- Kodningsklar spec ---";
const ACCEPT_CRITERION_STATUS_LABEL: Record<AcceptCriterionReviewStatus, string> = {
  pending: "Afventer",
  passed: "Bestået",
  failed: "Fejlet",
  skipped: "Sprunget over",
};

const ACCEPT_CRITERION_CATEGORY_LABEL: Record<AcceptCriterionCategory, string> = {
  functional: "Funktionelle",
  technical: "Tekniske",
};

function inferAcceptCriterionCategory(text: string): AcceptCriterionCategory {
  const hay = text.toLowerCase();
  if (
    /\b(test|pytest|api|sql|migration|gate|validate|typescript|\.tsx|router|schema|blob|token|playwright|ci|lint|auth|middleware|persist|neon|alembic|file_storage|canvas\.tsx)\b/.test(
      hay,
    )
  ) {
    return "technical";
  }
  return "functional";
}

function parseAcceptCriteriaFromDescription(description: string): Omit<
  AcceptCriterionReview,
  "status"
>[] {
  const specIdx = description.indexOf(SPEC_MARKER);
  const haystack = specIdx >= 0 ? description.slice(specIdx) : description;
  const markerRe = /Acceptkriterier\s*:?\s*/i;
  const match = markerRe.exec(haystack);
  if (!match || match.index == null) return [];

  let body = haystack.slice(match.index + match[0].length).trim();
  const stopRe = /\n(?:Mål|Scope|Output|Flow|Upstream|Downstream|---)\s*:/i;
  const stopIdx = body.search(stopRe);
  if (stopIdx >= 0) body = body.slice(0, stopIdx).trim();

  const lines: string[] = [];
  if (!body.includes("\n") && body.includes(";")) {
    for (const part of body.split(";")) {
      const trimmed = part.trim();
      if (trimmed.length >= 4) lines.push(trimmed);
    }
  } else {
    for (const raw of body.split("\n")) {
      const trimmed = raw.trim().replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
      if (trimmed.length >= 4) lines.push(trimmed);
    }
  }

  return lines.map((text, index) => ({
    id: `ac-${index + 1}`,
    text,
    category: inferAcceptCriterionCategory(text),
  }));
}

function mergeAcceptCriteriaForDisplay(task: Task): AcceptCriterionReview[] {
  const fromSpec = parseAcceptCriteriaFromDescription(task.description);
  const fromEvidence = task.agentReviewEvidence?.acceptCriteria ?? [];
  if (fromEvidence.length > 0) {
    const byId = new Map(fromEvidence.map((row) => [row.id, row]));
    return fromSpec.map((row) => byId.get(row.id) ?? { ...row, status: "pending" as const });
  }
  return fromSpec.map((row) => ({ ...row, status: "pending" as const }));
}

function formatAcceptCriterionStatusIcon(status: AcceptCriterionReviewStatus): string {
  if (status === "passed") return "✅";
  if (status === "failed") return "❌";
  if (status === "skipped") return "○";
  return "…";
}

function buildAcceptCriteriaVerificationLines(task: Task): string[] {
  const rows = mergeAcceptCriteriaForDisplay(task);
  if (rows.length === 0) return [];

  const lines: string[] = ["Acceptkriterier (spec):"];
  for (const category of ["functional", "technical"] as const) {
    const inCategory = rows.filter((row) => row.category === category);
    if (inCategory.length === 0) continue;
    lines.push(`${ACCEPT_CRITERION_CATEGORY_LABEL[category]}:`);
    for (const row of inCategory) {
      const method = row.method?.trim() ? ` (${row.method})` : "";
      const note = row.note?.trim() ? ` — ${row.note}` : "";
      lines.push(
        `- ${formatAcceptCriterionStatusIcon(row.status)} ${row.text}${method}${note}`,
      );
    }
  }
  const playwright = task.reviewPlaywrightEvidence;
  if (getReviewVerificationScope(task) === "stardesk" && playwright) {
    lines.push("");
    lines.push(
      `Playwright: ${playwright.status === "passed" ? "✅" : playwright.status === "failed" ? "❌" : "…"} ${playwright.log?.split("\n")[0] ?? ""}`.trim(),
    );
  }
  return lines;
}
const DETAIL_PANEL_HEIGHT_MIN = 80;
const DETAIL_PANEL_HEIGHT_MAX = 600;
const DETAIL_PANEL_AUTO_SCROLL_LINE_CAP = 40;
const DETAIL_PANEL_AUTO_MAX_HEIGHT = "70vh";
const DEFAULT_DETAIL_PANEL_HEIGHTS = {
  description: 200,
  plan: 180,
  review: 320,
} as const;

type DetailPanelHeightsFixed = {
  description: number;
  plan: number;
  review: number;
};

type DetailPanelHeightsState = null | "auto" | DetailPanelHeightsFixed;

function isDetailPanelAutoMode(heights: DetailPanelHeightsState): boolean {
  return heights == null || heights === "auto";
}

function resolveDetailPanelHeights(heights: DetailPanelHeightsState): {
  description: number | "auto";
  plan: number | "auto";
  review: number | "auto";
} {
  if (isDetailPanelAutoMode(heights)) {
    return { description: "auto", plan: "auto", review: "auto" };
  }
  return heights;
}

function countTextLines(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split("\n").length;
}

function textareaRowsForContent(
  text: string,
  options: { floor?: number; ceiling?: number; preferredMin?: number } = {},
): number {
  const floor = options.floor ?? 4;
  const ceiling = options.ceiling ?? 20;
  const preferredMin = options.preferredMin ?? floor;
  const lines = countTextLines(text);
  if (!lines) return preferredMin;
  return Math.max(floor, Math.min(ceiling, Math.max(preferredMin, lines)));
}

function reviewDeliveryTextAreaRows(text: string): number {
  return textareaRowsForContent(text, { floor: 4, ceiling: 20, preferredMin: 6 });
}

const WORKBOARD_DATA_JSON =
  ".cursor/projects/c-Users-kjaer-STARDESK-Cursor/canvases/stardesk-workboard.canvas.data.json";

/** Production web app — see STARDESK/docs/DOCUMENTATION.md */
const STARDESK_WEB_BASE_URL = "https://web-seven-neon-6bvmcoel7n.vercel.app";

const REVIEW_VERIFICATION_MISSING_MESSAGE =
  "Verifikationslink mangler — tjek manuelt på STARDESK før godkendelse.";

const REVIEW_VERIFICATION_INVALID_MESSAGE =
  "Ugyldigt verifikationslink — angiv en fuld STARDESK-URL eller sti som /aktiver.";

const REVIEW_VERIFICATION_CURSOR_NOTE =
  "Ændringen ses her i Work Board / Cursor — ingen STARDESK-verifikation nødvendig.";

const STARDESK_WEB_ORIGIN = new URL(STARDESK_WEB_BASE_URL).origin;

const VERIFICATION_QUICK_PICKS = [
  { path: "/aktiver", shortLabel: "Aktiver", label: "Åbn Aktiver-siden" },
  { path: "/tickets", shortLabel: "Sager", label: "Åbn sag-liste" },
  { path: "/portal", shortLabel: "Portal", label: "Åbn portalen" },
  { path: "/tickets/new", shortLabel: "Ny sag", label: "Åbn Ny sag" },
] as const;

const WORKBOARD_CANVAS_PATH_PATTERNS =
  /stardesk-workboard\.canvas\.(tsx|data\.json)|stardesk-workboard\.mdc|canvases\/stardesk-workboard/;

function inferReviewVerificationScope(task: Task): ReviewVerificationScope {
  if (task.reviewVerificationScope) return task.reviewVerificationScope;

  const hay = `${task.tags} ${task.title} ${task.description}`.toLowerCase();
  const tagHay = task.tags.toLowerCase();
  const hasWorkboardTag = /\b(workboard|canvas|kanban)\b/.test(hay);
  const hasCanvasOnlyPath = WORKBOARD_CANVAS_PATH_PATTERNS.test(hay);
  const hasStardeskRepoPath = /\bapps\/(web|api)\b|stardesk\/apps/.test(hay);
  const hasStardeskFeature =
    /\b(portal|selvbetjening|aktiver|sidebar|layout|tickets?|sagsliste|brugeradministration|admin\/users|login|attachments|images|cpr|auth|password|borger)\b/.test(
      hay,
    );
  const hasStardeskAppTag =
    /\b(ui|portal|aktiver|api|web|attachments|images)\b/.test(tagHay) &&
    !/\b(workboard|canvas|kanban)\b/.test(tagHay);

  if (
    /^(n8n|sonar|coverage|preprod|testsystem|restore|slack|jira|keycloak|sentry|playwright|golden|env,preprod)/.test(
      hay.replace(/\s+/g, " "),
    ) &&
    !hasStardeskFeature &&
    !hasWorkboardTag
  ) {
    return "none";
  }

  if (hasCanvasOnlyPath && !hasStardeskRepoPath) return "cursor";
  if (hasWorkboardTag && !hasStardeskFeature && !hasStardeskRepoPath) return "cursor";
  if (hasStardeskFeature || hasStardeskAppTag || hasStardeskRepoPath) return "stardesk";

  const label = (task.reviewVerificationLabel ?? "").toLowerCase();
  if (label.includes("work board") || label.includes("canvas")) return "cursor";

  const url = task.reviewVerificationUrl?.trim();
  if (url) return hasWorkboardTag ? "cursor" : "stardesk";
  if (hasWorkboardTag) return "cursor";
  return "stardesk";
}

function getReviewVerificationScope(
  task: Task,
  draftScope?: ReviewVerificationScope,
): ReviewVerificationScope {
  if (draftScope) return draftScope;
  if (task.reviewVerificationScope) return task.reviewVerificationScope;
  return inferReviewVerificationScope(task);
}

function parseReviewDeliveryFromDescription(description: string): {
  heading: string | null;
  summary: string | null;
} {
  const match = description.match(
    new RegExp(
      `${REVIEW_DELIVERY_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\nOverskrift:\\s*([^\\n]+)\\s*\\n\\n([\\s\\S]*?)(?:\\n\\n---|$)`,
    ),
  );
  if (!match) return { heading: null, summary: null };
  return { heading: match[1]?.trim() || null, summary: match[2]?.trim() || null };
}

function getReviewDelivery(task: Task): {
  heading: string;
  summary: string | null;
  at: number | null;
  actor: ActivityActor | null;
  verificationUrl: string | null;
  verificationLabel: string | null;
  verificationScope: ReviewVerificationScope;
} {
  const heading =
    task.reviewDeliveryHeading?.trim() ||
    parseReviewDeliveryFromDescription(task.description).heading ||
    "Leverance til review";
  const summary =
    task.reviewDeliverySummary?.trim() ||
    parseReviewDeliveryFromDescription(task.description).summary ||
    null;
  const at = task.reviewDeliveryAt ?? null;
  const scope = getReviewVerificationScope(task);
  const rawVerificationUrl =
    scope === "stardesk" ? task.reviewVerificationUrl?.trim() || null : null;
  const verificationUrl = rawVerificationUrl
    ? normalizeVerificationUrl(rawVerificationUrl)
    : null;
  const verificationLabel =
    scope === "stardesk" ? task.reviewVerificationLabel?.trim() || null : null;
  return {
    heading,
    summary,
    at,
    actor: task.reviewDeliveryActor ?? null,
    verificationUrl,
    verificationLabel,
    verificationScope: scope,
  };
}

const VERIFICATION_PATH_LABELS: Record<string, string> = {
  "/": "Se ændring på STARDESK",
  "/aktiver": "Åbn Aktiver-siden",
  "/tickets": "Åbn sag-liste",
  "/tickets/new": "Åbn Ny sag",
  "/tickets/major": "Åbn store sager",
  "/portal": "Åbn portalen",
  "/portal/knowledge": "Åbn portal-viden",
  "/kanban": "Åbn kanban",
  "/login": "Åbn login",
  "/users": "Åbn brugeradministration",
  "/admin/dashboard": "Åbn admin",
  "/knowledge": "Åbn vidensbase",
  "/service-desk": "Åbn service desk",
};

function stripVerificationJunk(input: string): string {
  return input.split(/\s+eller\s+/i)[0]?.trim() ?? input.trim();
}

function extractVerificationCandidate(input: string): string | null {
  const cleaned = stripVerificationJunk(input);
  if (!cleaned) return null;

  const fullUrlMatch = cleaned.match(/https?:\/\/[^\s]+/i);
  if (fullUrlMatch) return fullUrlMatch[0]!.replace(/[,;.]+$/, "");

  const pathMatch = cleaned.match(/(\/[a-z0-9\-_/[\]{}]+)/i);
  if (pathMatch) return pathMatch[1]!;

  return null;
}

function normalizeVerificationUrl(input: string): string | null {
  const candidate = extractVerificationCandidate(input);
  if (!candidate) return null;

  const full = /^https?:\/\//i.test(candidate)
    ? candidate
    : `${STARDESK_WEB_BASE_URL}${candidate.startsWith("/") ? candidate : `/${candidate}`}`;

  try {
    const parsed = new URL(full);
    if (parsed.origin !== STARDESK_WEB_ORIGIN) return null;
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function resolveVerificationLabel(url: string, label: string | null): string {
  if (label?.trim()) return label.trim();
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (VERIFICATION_PATH_LABELS[path]) return VERIFICATION_PATH_LABELS[path]!;
    const ticketMatch = path.match(/^\/tickets\/([0-9a-f-]{36})$/i);
    if (ticketMatch) return "Åbn sagen";
    if (path === "/" || path === "") return "Se ændring på STARDESK";
    return `Åbn ${path}`;
  } catch {
    return "Se ændring på STARDESK";
  }
}

function openVerificationUrl(url: string): void {
  const normalized = normalizeVerificationUrl(url);
  if (!normalized) return;
  globalThis.open?.(normalized, "_blank", "noopener,noreferrer");
}

function isGenericReviewDelivery(heading: string, summary: string): boolean {
  const h = heading.trim();
  const s = summary.trim();
  if (!s) return true;
  if (s.startsWith("Planlagt leverance:")) return true;
  if (/^Leverance klar til review/i.test(s)) return true;
  if (GENERIC_REVIEW_DELIVERY_HEADINGS.has(h) && s.length < REVIEW_DELIVERY_MIN_SUMMARY_LEN) {
    return true;
  }
  return false;
}

function hasReviewDeliveryReady(task: Task, draftSummary?: string): boolean {
  const summary =
    draftSummary?.trim() ||
    task.reviewDeliverySummary?.trim() ||
    getReviewDelivery(task).summary?.trim() ||
    "";
  const heading =
    task.reviewDeliveryHeading?.trim() ||
    getReviewDelivery(task).heading?.trim() ||
    "";
  if (heading.length === 0 || summary.length < REVIEW_DELIVERY_MIN_SUMMARY_LEN) {
    return false;
  }
  return !isGenericReviewDelivery(heading, summary);
}

function reviewDeliveryBlockMessage(task: Task, draftSummary?: string): string {
  const summary =
    draftSummary?.trim() ||
    task.reviewDeliverySummary?.trim() ||
    getReviewDelivery(task).summary?.trim() ||
    "";
  const heading =
    task.reviewDeliveryHeading?.trim() ||
    getReviewDelivery(task).heading?.trim() ||
    "";
  if (!summary || summary.length < REVIEW_DELIVERY_MIN_SUMMARY_LEN) {
    return REVIEW_DELIVERY_REQUIRED_MESSAGE;
  }
  if (isGenericReviewDelivery(heading, summary)) {
    return REVIEW_DELIVERY_GENERIC_MESSAGE;
  }
  return REVIEW_DELIVERY_REQUIRED_MESSAGE;
}

function hasAgentPlanReady(task: Task, draftPlan?: string): boolean {
  const plan =
    draftPlan?.trim() ||
    task.agentPlan?.trim() ||
    "";
  return plan.length >= AGENT_PLAN_MIN_LEN;
}

function normalizeTrackedFieldValue(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function fieldHistoryEntriesEqual(a: FieldVersion, b: FieldVersion): boolean {
  return (
    a.at === b.at &&
    normalizeTrackedFieldValue(a.value) === normalizeTrackedFieldValue(b.value)
  );
}

function fieldHistoryContainsValue(entries: FieldVersion[], value: string): boolean {
  const normalized = normalizeTrackedFieldValue(value);
  if (!normalized) return false;
  return entries.some((entry) => normalizeTrackedFieldValue(entry.value) === normalized);
}

function mergeFieldHistoryEntryArrays(
  persisted: FieldVersion[],
  incoming: FieldVersion[],
): FieldVersion[] {
  if (persisted.length === 0) return incoming.slice(-FIELD_HISTORY_LIMIT);
  if (incoming.length === 0) return persisted.slice(-FIELD_HISTORY_LIMIT);
  const combined = [...persisted];
  for (const entry of incoming) {
    if (!combined.some((existing) => fieldHistoryEntriesEqual(existing, entry))) {
      combined.push(entry);
    }
  }
  return combined.sort((a, b) => a.at - b.at).slice(-FIELD_HISTORY_LIMIT);
}

function mergeFieldHistoryPreserved(
  persisted: FieldHistory | undefined,
  incoming: FieldHistory | undefined,
): FieldHistory | undefined {
  if (!persisted && !incoming) return undefined;
  const merged: FieldHistory = { ...(incoming ?? {}) };
  for (const field of TRACKED_FIELD_KEYS) {
    const p = persisted?.[field] ?? [];
    const h = incoming?.[field] ?? [];
    if (p.length === 0 && h.length === 0) continue;
    merged[field] = mergeFieldHistoryEntryArrays(p, h);
  }
  return merged;
}

function fieldHistoryEqual(
  a: FieldHistory | undefined,
  b: FieldHistory | undefined,
): boolean {
  for (const field of TRACKED_FIELD_KEYS) {
    const aa = a?.[field] ?? [];
    const bb = b?.[field] ?? [];
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) {
      if (!fieldHistoryEntriesEqual(aa[i]!, bb[i]!)) return false;
    }
  }
  return true;
}

function getTrackedFieldSeedMeta(
  task: Task,
  field: TrackedFieldKey,
): { at: number; actor: ActivityActor } {
  switch (field) {
    case "description":
      return { at: task.createdAt ?? Date.now(), actor: "user" };
    case "agentPlan":
      return {
        at: task.agentPlanAt ?? task.createdAt ?? Date.now(),
        actor: task.agentPlanActor ?? "agent",
      };
    case "reviewDeliverySummary":
      return {
        at: task.reviewDeliveryAt ?? task.createdAt ?? Date.now(),
        actor: task.reviewDeliveryActor ?? "agent",
      };
    case "reviewPrepSummary":
      return {
        at: task.reviewPrepAt ?? task.createdAt ?? Date.now(),
        actor: task.reviewPrepActor ?? "agent",
      };
    case "agentReviewView":
      return {
        at: task.agentReviewViewAt ?? task.agentReviewEvidence?.at ?? task.createdAt ?? Date.now(),
        actor: task.agentReviewViewActor ?? "agent",
      };
  }
}

function applyAgentPlanToTask(
  task: Task,
  plan: string,
  actor: ActivityActor = "user",
): Task {
  const trimmed = normalizeTrackedFieldValue(plan);
  const previous = normalizeTrackedFieldValue(task.agentPlan);
  const at = Date.now();
  const withFields = appendFieldHistoryIfChanged(
    {
      ...task,
      agentPlan: trimmed,
      agentPlanAt: at,
      agentPlanActor: actor,
    },
    "agentPlan",
    previous,
    trimmed,
    actor,
  );
  return appendTaskActivity(withFields, actor, "Agent-plan gemt");
}

function inferAgentPlan(task: Task): string {
  const { specSections } = parseTaskDescriptionForView(task.description);
  const mal = specSections.find((section) => section.label.toLowerCase() === "mål");
  const scope = specSections.find((section) => section.label.toLowerCase() === "scope");
  const output = specSections.find((section) => section.label.toLowerCase() === "output");
  const accept = specSections.find((section) =>
    section.label.toLowerCase().startsWith("accept"),
  );
  const delivery = task.reviewDeliverySummary?.trim() ?? "";
  const steps: string[] = [];

  steps.push(
    `1. Læs kodningsklar spec og acceptkriterier for opgave #${formatTaskNumber(task)} (${task.title}).`,
  );

  if (mal?.body.trim()) {
    const malLine = mal.body.split("\n").find((line) => line.trim())?.trim() ?? mal.body.trim();
    steps.push(`2. Mål: ${malLine.replace(/^[-•]\s*/, "")}`);
  }

  if (scope?.body.trim()) {
    const scopeLines = scope.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4);
    for (const line of scopeLines) {
      steps.push(`${steps.length + 1}. Scope: ${line.replace(/^[-•]\s*/, "")}`);
    }
  } else if (output?.body.trim()) {
    const outputLines = output.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);
    for (const line of outputLines) {
      steps.push(`${steps.length + 1}. Output: ${line.replace(/^[-•]\s*/, "")}`);
    }
  }

  if (delivery) {
    steps.push(
      `${steps.length + 1}. Gennemfør implementering i repo/canvas som beskrevet i leverance.`,
    );
    const deliveryBullets = delivery
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("-") || line.startsWith("•"))
      .slice(0, 4);
    for (const line of deliveryBullets) {
      steps.push(`${steps.length + 1}. ${line.replace(/^[-•]\s*/, "")}`);
    }
  } else {
    steps.push(
      `${steps.length + 1}. Implementér i STARdesk repo (apps/web, apps/api) eller Work Board canvas efter scope.`,
    );
    steps.push(
      `${steps.length + 1}. Opdater stardesk-workboard.canvas.data.json med leverance og agentPlan; flyt til Review.`,
    );
  }

  if (accept?.body.trim()) {
    steps.push(`${steps.length + 1}. Verificér acceptkriterier:`);
    const acceptLines = accept.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4);
    for (const line of acceptLines) {
      steps.push(`   - ${line.replace(/^[-•]\s*/, "")}`);
    }
  }

  steps.push(
    `${steps.length + 1}. Udfyld reviewPrep og reviewDelivery; sæt reviewVerificationScope og URL (ved STARDESK-scope).`,
  );

  return steps.join("\n");
}

function backfillAgentPlanIfNeeded(task: Task): Task {
  const needsPlan =
    isAnyReviewColumnStatus(task.status) || task.status === "In Progress";
  if (!needsPlan) return task;
  if ((task.fieldHistory?.agentPlan?.length ?? 0) > 0) return task;
  if (normalizeTrackedFieldValue(task.agentPlan)) return task;

  const inferred = inferAgentPlan(task);
  if (!hasAgentPlanReady(task, inferred)) return task;

  const at = Date.now();
  const withPlan = appendFieldHistoryIfChanged(
    {
      ...task,
      agentPlan: inferred,
      agentPlanAt: at,
      agentPlanActor: "agent",
    },
    "agentPlan",
    "",
    inferred,
    "agent",
    "Backfill fra spec/leverance",
  );
  return appendTaskActivity(
    withPlan,
    "agent",
    "Agent-plan backfill",
    "Udledt fra spec og leverance",
  );
}

function formatActivityWhen(at: number | null): string | null {
  if (at == null) return null;
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(at));
}

const formatReviewDeliveryWhen = formatActivityWhen;

function appendTaskActivity(
  task: Task,
  actor: ActivityActor,
  action: string,
  detail?: string,
): Task {
  const trimmedAction = action.trim();
  if (!trimmedAction) return task;
  const entry: TaskActivityEntry = {
    at: Date.now(),
    actor,
    action: trimmedAction,
    ...(detail?.trim() ? { detail: detail.trim() } : {}),
  };
  return {
    ...task,
    activityLog: [...(task.activityLog ?? []), entry],
  };
}

/** Standard activityLog action for downstream workflow transitions. */
function appendWorkflowTransitionActivity(
  task: Task,
  fromStatus: Status,
  toStatus: Status,
  actor: ActivityActor = "agent",
): Task {
  const detail = getReviewDelivery(task).heading?.trim() || undefined;
  if (fromStatus === "In Progress" && toStatus === "Review") {
    return appendTaskActivity(task, actor, "Implementering færdig → Agent Review", detail);
  }
  if (fromStatus === "Review" && toStatus === "Human Review") {
    return appendTaskActivity(task, actor, "Agent review bestået → Human Review", detail);
  }
  return appendTaskActivity(
    task,
    actor,
    `Status ændret til ${COLUMN_LABELS[toStatus]}`,
    detail,
  );
}

function formatActivityActor(actor: ActivityActor | undefined): string {
  return actor ? ACTOR_LABEL_DA[actor] : "—";
}

function appendFieldHistoryIfChanged(
  task: Task,
  field: TrackedFieldKey,
  previousValue: string,
  newValue: string,
  actor: ActivityActor,
  note?: string,
): Task {
  const previous = normalizeTrackedFieldValue(previousValue);
  const next = normalizeTrackedFieldValue(newValue);
  if (next === previous) return task;
  const prior = task.fieldHistory?.[field] ?? [];
  const entries: FieldVersion[] = [...prior];
  if (previous !== "" && !fieldHistoryContainsValue(entries, previous)) {
    const seedMeta = getTrackedFieldSeedMeta(task, field);
    entries.push({
      at: seedMeta.at,
      actor: seedMeta.actor,
      value: previous,
      note: entries.length === 0 ? "Oprindelig værdi" : undefined,
    });
  }
  const entry: FieldVersion = {
    at: Date.now(),
    actor,
    value: next,
    ...(note?.trim() ? { note: note.trim() } : {}),
  };
  entries.push(entry);
  return {
    ...task,
    fieldHistory: {
      ...task.fieldHistory,
      [field]: entries.slice(-FIELD_HISTORY_LIMIT),
    },
  };
}

function patchTaskFields(prev: Task[], taskId: string, patch: Partial<Task>): Task[] {
  return prev.map((entry) => {
    if (entry.id !== taskId) return entry;
    const next: Task = { ...entry, ...patch };
    if (patch.fieldHistory != null) {
      next.fieldHistory = mergeFieldHistoryPreserved(entry.fieldHistory, patch.fieldHistory);
    }
    return next;
  });
}

function ensureFieldHistoryBackfill(task: Task): Task {
  let next = task;
  const seeds: Array<{
    field: TrackedFieldKey;
    value: string;
    at: number;
    actor: ActivityActor;
  }> = [
    {
      field: "description",
      value: task.description.trim(),
      at: task.createdAt ?? Date.now(),
      actor: "user",
    },
    {
      field: "reviewDeliverySummary",
      value: (task.reviewDeliverySummary ?? "").trim(),
      at: task.reviewDeliveryAt ?? task.createdAt ?? Date.now(),
      actor: task.reviewDeliveryActor ?? "agent",
    },
    {
      field: "reviewPrepSummary",
      value: (task.reviewPrepSummary ?? "").trim(),
      at: task.reviewPrepAt ?? task.createdAt ?? Date.now(),
      actor: task.reviewPrepActor ?? "agent",
    },
    {
      field: "agentPlan",
      value: (task.agentPlan ?? "").trim(),
      at: task.agentPlanAt ?? task.createdAt ?? Date.now(),
      actor: task.agentPlanActor ?? "agent",
    },
    {
      field: "agentReviewView",
      value: (task.agentReviewView ?? "").trim(),
      at: task.agentReviewViewAt ?? task.agentReviewEvidence?.at ?? task.createdAt ?? Date.now(),
      actor: task.agentReviewViewActor ?? "agent",
    },
  ];
  for (const seed of seeds) {
    if (!seed.value) continue;
    const existing = next.fieldHistory?.[seed.field] ?? [];
    if (existing.length > 0) continue;
    next = appendFieldHistoryIfChanged(
      next,
      seed.field,
      "",
      seed.value,
      seed.actor,
      "Oprindelig værdi",
    );
  }
  return next;
}

function CollapsibleVersionHistory({
  entries,
  theme,
}: {
  entries: FieldVersion[];
  theme: ReturnType<typeof useHostTheme>;
}) {
  if (entries.length === 0) return null;
  const reversed = [...entries].reverse();
  return (
    <CollapsibleSection title="Versionshistorik" count={entries.length}>
      <Stack
        gap={6}
        style={{
          marginTop: 6,
          paddingLeft: 8,
          borderLeft: `2px solid ${theme.stroke.tertiary}`,
        }}
      >
        {reversed.map((entry, index) => (
          <Stack key={`${entry.at}-${index}`} gap={2}>
            <Text size="small" weight="semibold">
              {formatActivityWhen(entry.at)} · {formatActivityActor(entry.actor)}
              {entry.note ? (
                <Text as="span" size="small" tone="tertiary">
                  {" "}
                  · {entry.note}
                </Text>
              ) : null}
            </Text>
            <Text size="small" tone="secondary" style={{ whiteSpace: "pre-wrap" }}>
              {entry.value.length > 600 ? `${entry.value.slice(0, 600)}…` : entry.value}
            </Text>
          </Stack>
        ))}
      </Stack>
    </CollapsibleSection>
  );
}

function applyReviewDeliveryToTask(
  task: Task,
  heading: string,
  summary: string,
  actor: ActivityActor = "user",
  verificationUrl?: string,
  verificationLabel?: string,
  verificationScope?: ReviewVerificationScope,
): Task {
  const trimmedSummary = normalizeTrackedFieldValue(summary);
  const trimmedHeading = heading.trim() || "Leverance til review";
  const previousSummary = normalizeTrackedFieldValue(task.reviewDeliverySummary);
  const scope = getReviewVerificationScope(
    { ...task, reviewDeliverySummary: trimmedSummary },
    verificationScope,
  );
  let urlInput = scope === "stardesk" ? (verificationUrl?.trim() ?? "") : "";
  let trimmedLabel = scope === "stardesk" ? (verificationLabel?.trim() ?? "") : "";
  if (scope === "stardesk" && !urlInput) {
    const inferred = inferReviewVerificationUrl({
      ...task,
      reviewDeliverySummary: trimmedSummary,
    });
    urlInput = inferred.url;
    if (!trimmedLabel) trimmedLabel = inferred.label;
  }
  const normalizedUrl =
    scope === "stardesk" && urlInput ? normalizeVerificationUrl(urlInput) : null;
  const at = Date.now();
  const withFields = appendFieldHistoryIfChanged(
    {
      ...task,
      reviewDeliveryHeading: trimmedHeading,
      reviewDeliverySummary: trimmedSummary,
      reviewDeliveryAt: at,
      reviewDeliveryActor: actor,
      reviewVerificationScope: scope,
      reviewVerificationUrl: normalizedUrl ?? undefined,
      reviewVerificationLabel: scope === "stardesk" && normalizedUrl ? trimmedLabel || undefined : undefined,
    },
    "reviewDeliverySummary",
    previousSummary,
    trimmedSummary,
    actor,
  );
  return appendTaskActivity(withFields, actor, "Leverance til review", trimmedHeading);
}

/** Canvas cannot run Playwright — marks pending/skipped and documents external runner. */
function applyPlaywrightEvidenceOnReviewTransition(task: Task): Task {
  const scope = getReviewVerificationScope(task);
  const at = Date.now();
  if (scope !== "stardesk") {
    const log =
      scope === "cursor"
        ? "Playwright-kørsel springes over — reviewVerificationScope er cursor (kun Work Board)."
        : "Playwright-kørsel springes over — intet STARDESK-verifikationslink.";
    return {
      ...task,
      reviewPlaywrightEvidence: {
        at,
        actor: "agent",
        status: "skipped",
        log,
        screenshots: [],
      },
    };
  }
  const url = task.reviewVerificationUrl?.trim();
  if (!url) {
    return {
      ...task,
      reviewPlaywrightEvidence: {
        at,
        actor: "agent",
        status: "skipped",
        log: "Playwright-kørsel springes over — reviewVerificationUrl mangler ved scope stardesk.",
        screenshots: [],
      },
    };
  }
  const taskNo = formatTaskNumber(task);
  return appendTaskActivity(
    {
      ...task,
      reviewPlaywrightEvidence: {
        at,
        actor: "agent",
        status: "pending",
        verificationUrl: url,
        log: [
          "Playwright-evidence afventer ekstern runner (canvas kører ikke Playwright).",
          `Mål-URL: ${url}`,
          `Lokal pipeline: npm run review:playwright:pipeline -- --task ${taskNo} (fra STARDESK/scripts)`,
          `GitHub Actions: Review Playwright Evidence → Run workflow → task ${taskNo}`,
          "Se STARDESK/docs/review-playwright-agent.md",
        ].join("\n"),
        screenshots: [],
      },
    },
    "agent",
    "Playwright-evidence sat til pending",
    url,
  );
}

const AGENT_REVIEW_EVIDENCE_STATUS_LABEL: Record<AgentReviewEvidence["status"], string> = {
  pending: "Afventer verifikation",
  running: "Verificerer…",
  passed: "Bestået",
  failed: "Fejlet",
  skipped: "Sprunget over",
};

const AGENT_REVIEW_METHOD_LABEL: Record<AgentReviewEvidenceMethod, string> = {
  playwright: "Playwright E2E",
  agent: "Agent self-review",
  code: "Kodegennemgang",
  canvas: "Canvas/Work Board",
  hybrid: "Hybrid (Playwright + agent)",
  manual: "Manuel",
};

function buildInitialAgentReviewViewPlan(task: Task): string {
  const scope = getReviewVerificationScope(task);
  const method = resolveAgentReviewMethod(scope);
  const methodLabel = AGENT_REVIEW_METHOD_LABEL[method];
  const planLines: string[] = [AGENT_REVIEW_VIEW_PLAN_MARKER];
  if (scope === "stardesk") {
    const url = task.reviewVerificationUrl?.trim();
    planLines.push(
      `Metode: ${methodLabel} mod deployed STARDESK${url ? ` (${url})` : ""}.`,
    );
    planLines.push("- Playwright smoke via review:playwright:pipeline (scope stardesk)");
    planLines.push("- Agent gennemgår leverance mod URL og acceptkriterier");
  } else if (scope === "cursor") {
    planLines.push(`Metode: ${methodLabel} — inspektér ændrede filer og Work Board canvas.`);
    planLines.push("- Kode/canvas-inspektion (ingen Playwright)");
  } else {
    planLines.push(`Metode: ${methodLabel} — gennemgå leverance og acceptkriterier.`);
  }
  const acCount = parseAcceptCriteriaFromDescription(task.description).length;
  if (acCount > 0) {
    planLines.push(`- Gennemgå ${acCount} acceptkriterier (funktionelt + teknisk) fra spec`);
  }
  planLines.push("- Udfyld agentReviewEvidence.acceptCriteria før passed/failed");
  planLines.push("");
  planLines.push(AGENT_REVIEW_VIEW_DONE_MARKER);
  planLines.push("(Afventer agent review — AC-matrix udfyldes når agentReviewEvidence opdateres.)");
  return planLines.join("\n");
}

function buildAgentReviewViewFromEvidence(task: Task): string {
  const evidence = task.agentReviewEvidence;
  const existing = task.agentReviewView?.trim() ?? "";
  let planSection = "";
  if (existing.includes(AGENT_REVIEW_VIEW_PLAN_MARKER)) {
    const doneIdx = existing.indexOf(AGENT_REVIEW_VIEW_DONE_MARKER);
    planSection =
      doneIdx >= 0 ? existing.slice(0, doneIdx).trim() : existing.trim();
  } else {
    planSection = buildInitialAgentReviewViewPlan(task).split(AGENT_REVIEW_VIEW_DONE_MARKER)[0]?.trim() ?? AGENT_REVIEW_VIEW_PLAN_MARKER;
  }

  const verifiedLines: string[] = [AGENT_REVIEW_VIEW_DONE_MARKER];
  if (!evidence) {
    verifiedLines.push("(Ingen verifikation endnu.)");
  } else {
    verifiedLines.push(`Status: ${AGENT_REVIEW_EVIDENCE_STATUS_LABEL[evidence.status]}`);
    verifiedLines.push(`Metode: ${AGENT_REVIEW_METHOD_LABEL[evidence.method]}`);
    if (evidence.summary?.trim()) verifiedLines.push(evidence.summary.trim());
    const acLines = buildAcceptCriteriaVerificationLines(task);
    if (acLines.length > 0) {
      verifiedLines.push("");
      verifiedLines.push(...acLines);
    }
    if (evidence.findings && evidence.findings.length > 0) {
      verifiedLines.push("");
      verifiedLines.push("Fund:");
      for (const finding of evidence.findings) {
        verifiedLines.push(`- ${finding}`);
      }
    }
    if (evidence.humanReviewHandoff?.trim()) {
      verifiedLines.push("");
      verifiedLines.push("Handoff til Jan:");
      verifiedLines.push(evidence.humanReviewHandoff.trim());
    }
    if (evidence.verifiedAt) {
      verifiedLines.push("");
      verifiedLines.push(`Verificeret: ${formatActivityWhen(evidence.verifiedAt)}`);
    }
  }
  return `${planSection.trim()}\n\n${verifiedLines.join("\n")}`;
}

function agentReviewViewNeedsEvidenceSync(task: Task): boolean {
  const evidence = task.agentReviewEvidence;
  if (!evidence) return false;
  const view = task.agentReviewView?.trim() ?? "";
  if (!view) return true;
  const evidenceAt = evidence.verifiedAt ?? evidence.at;
  const viewAt = task.agentReviewViewAt ?? 0;
  if (evidenceAt > viewAt) return true;
  if (evidence.status === "passed" || evidence.status === "failed") {
    return !view.includes(AGENT_REVIEW_EVIDENCE_STATUS_LABEL[evidence.status]);
  }
  return false;
}

function syncAgentReviewViewFromEvidence(task: Task, actor: ActivityActor = "agent"): Task {
  if (!agentReviewViewNeedsEvidenceSync(task)) return task;
  const nextView = buildAgentReviewViewFromEvidence(task);
  return applyAgentReviewViewToTask(task, nextView, actor, { silentActivity: true });
}

function applyAgentReviewViewToTask(
  task: Task,
  view: string,
  actor: ActivityActor = "agent",
  options?: { silentActivity?: boolean },
): Task {
  const trimmed = normalizeTrackedFieldValue(view);
  const previous = normalizeTrackedFieldValue(task.agentReviewView);
  if (trimmed === previous) return task;
  const at = Date.now();
  const withFields = appendFieldHistoryIfChanged(
    {
      ...task,
      agentReviewView: trimmed,
      agentReviewViewAt: at,
      agentReviewViewActor: actor,
    },
    "agentReviewView",
    previous,
    trimmed,
    actor,
  );
  if (options?.silentActivity) return withFields;
  return appendTaskActivity(withFields, actor, "Agent View opdateret");
}

function getEvidenceBannerTitle(
  gate: AgentReviewVerificationGate,
  status?: AgentReviewEvidence["status"],
): string {
  if (gate.blocked) {
    if (status === "failed") return "Human Review blokeret";
    return "Verifikation afventer";
  }
  if (status === "passed") return "Verifikation bestået";
  if (status === "failed") return "Verifikation fejlet";
  if (status === "skipped") return "Verifikation sprunget over";
  if (status === "running") return "Verificerer…";
  if (status === "pending") return "Verifikation afventer";
  return "Verifikation";
}

function resolveAgentReviewMethod(scope: ReviewVerificationScope): AgentReviewEvidenceMethod {
  if (scope === "stardesk") return "hybrid";
  if (scope === "cursor") return "canvas";
  return "agent";
}

function resolveAgentReviewSubagentMethods(
  scope: ReviewVerificationScope,
): AgentReviewEvidenceMethod[] {
  if (scope === "stardesk") return ["playwright", "agent"];
  if (scope === "cursor") return ["code", "canvas"];
  return ["agent"];
}

/** Canvas cannot verify — marks pending and documents external Agent Review runner. */
function applyAgentReviewEvidenceOnReviewTransition(task: Task): Task {
  const scope = getReviewVerificationScope(task);
  const method = resolveAgentReviewMethod(scope);
  const at = Date.now();
  const summary =
    scope === "stardesk"
      ? "Agent Review: Playwright smoke + agent-verifikation mod deployed STARDESK."
      : scope === "cursor"
        ? "Agent Review: kode/canvas-inspektion (ingen Playwright)."
        : "Agent Review: agent self-review mod leverance og acceptkriterier.";
  return appendTaskActivity(
    applyAgentReviewViewToTask(
      {
        ...task,
        agentReviewEvidence: {
          at,
          actor: "agent",
          status: "pending",
          method,
          summary,
          subagentMethods: resolveAgentReviewSubagentMethods(scope),
        },
        agentReviewAgentStartedAt: undefined,
      },
      buildInitialAgentReviewViewPlan(task),
      "agent",
      { silentActivity: true },
    ),
    "agent",
    "Agent Review-verifikation sat til pending",
    AGENT_REVIEW_METHOD_LABEL[method],
  );
}

function getAgentReviewVerificationGate(task: Task): AgentReviewVerificationGate {
  const evidence = task.agentReviewEvidence;
  const playwright = task.reviewPlaywrightEvidence;
  const scope = getReviewVerificationScope(task);
  const messages: string[] = [];

  if (!evidence) {
    messages.push("Agent Review-verifikation er ikke startet endnu.");
  } else if (evidence.status === "failed") {
    if (AGENT_REVIEW_BLOCK_HUMAN_ON_FAILED) {
      return {
        blocked: true,
        warn: false,
        message:
          evidence.summary?.trim() ||
          "Agent Review fejlede — ret opgaven eller genkør verifikation før Human Review.",
      };
    }
    messages.push("Agent Review fejlede — overvej at rette før Human Review.");
  } else if (evidence.status === "pending" || evidence.status === "running") {
    const pendingMsg =
      evidence.status === "running"
        ? "Agent Review kører — afvent resultat før Human Review."
        : "Agent Review afventer — fuldfør verifikation før Human Review.";
    if (AGENT_REVIEW_BLOCK_HUMAN_ON_PENDING) {
      return { blocked: true, warn: false, message: pendingMsg };
    }
    messages.push(pendingMsg);
  }

  const specAcceptCount = parseAcceptCriteriaFromDescription(task.description).length;
  if (specAcceptCount > 0 && evidence?.status === "passed") {
    const rows = mergeAcceptCriteriaForDisplay(task);
    const open = rows.filter((row) => row.status === "pending" || row.status === "failed");
    if (open.length > 0) {
      return {
        blocked: true,
        warn: false,
        message:
          "Acceptkriterier ikke fuldt verificeret — review-agent skal udfylde acceptCriteria (alle bestået eller sprunget over med note).",
      };
    }
  }

  if (
    scope === "stardesk" &&
    playwright &&
    (playwright.status === "pending" || playwright.status === "running")
  ) {
    const pwMsg = "Playwright-evidence afventer stadig kørsel.";
    if (AGENT_REVIEW_BLOCK_HUMAN_ON_PENDING) {
      return { blocked: true, warn: false, message: pwMsg };
    }
    messages.push(pwMsg);
  }
  if (scope === "stardesk" && playwright?.status === "failed") {
    const pwFailMsg = "Playwright-evidence fejlede — tjek før Human Review.";
    if (AGENT_REVIEW_BLOCK_HUMAN_ON_FAILED) {
      return { blocked: true, warn: false, message: pwFailMsg };
    }
    messages.push(pwFailMsg);
  }

  if (messages.length === 0) return { blocked: false, warn: false, message: null };

  const blocked =
    (AGENT_REVIEW_BLOCK_HUMAN_ON_FAILED && evidence?.status === "failed") ||
    (AGENT_REVIEW_BLOCK_HUMAN_ON_PENDING &&
      (evidence?.status === "pending" ||
        evidence?.status === "running" ||
        !evidence)) ||
    (AGENT_REVIEW_BLOCK_HUMAN_ON_PENDING &&
      scope === "stardesk" &&
      (playwright?.status === "pending" || playwright?.status === "running"));

  return {
    blocked,
    warn: false,
    message: messages.join(" "),
  };
}

function applyReviewTransitionEvidence(task: Task): Task {
  return applyAgentReviewEvidenceOnReviewTransition(
    applyPlaywrightEvidenceOnReviewTransition(task),
  );
}

function buildAgentReviewPrompt(task: Task): string {
  const delivery = getReviewDelivery(task);
  const scope = getReviewVerificationScope(task);
  const playwright = task.reviewPlaywrightEvidence;
  const agentEvidence = task.agentReviewEvidence;
  const specIdx = task.description.indexOf(SPEC_MARKER);
  const spec =
    specIdx >= 0 ? task.description.slice(specIdx) : task.description.slice(0, 4000);
  const taskNo = formatTaskNumber(task);
  const skillPath = "STARDESK/.cursor/skills/stardesk-agent-review/SKILL.md";
  const playwrightBlock = playwright
    ? `Status: ${playwright.status}\n${playwright.log}`
    : scope === "stardesk"
      ? "Ikke sat endnu — kør pipeline (se nedenfor)."
      : "Springes over (scope cursor/none).";
  const pipelineCmd = buildPlaywrightPipelineCommand(task);

  return `# Work Board #${taskNo} — AGENT REVIEW (verifikation)

## Opgave
${task.title}

## Opgave-id
${task.id}

## Skill (LÆS FØRST)
\`${skillPath}\`

## Verifikations-scope
\`${scope}\`${scope === "stardesk" && delivery.verificationUrl ? `\nURL: ${delivery.verificationUrl}` : ""}${delivery.verificationLabel ? `\nLinktekst: ${delivery.verificationLabel}` : ""}

## Leverance
${delivery.heading ? `### ${delivery.heading}\n` : ""}${delivery.summary?.trim() || "(mangler reviewDeliverySummary)"}

## Agent-plan
${task.agentPlan?.trim() || "(mangler agentPlan)"}

## Agent Review-evidence (nuværende)
${agentEvidence ? `Status: ${agentEvidence.status}\nMetode: ${agentEvidence.method}\n${agentEvidence.summary ?? ""}` : "pending — du skal udfylde efter verifikation"}

## Agent View (synk til felt \`agentReviewView\`)
${task.agentReviewView?.trim() || "(tom — udfyldes automatisk ved evidence-opdatering)"}

## Playwright-evidence
${playwrightBlock}

${scope === "stardesk" ? `### Playwright pipeline\n\`\`\`\n${pipelineCmd}\n\`\`\`\n` : ""}
## Din opgave
1. Læs skill \`${skillPath}\` — følg metode for scope \`${scope}\`.
2. **Review-agentens kerneopgave:** Hold **LEVERANCE** op mod **alle acceptkriterier** i spec (funktionelle + tekniske). Playwright er kun bevis for UI-flow ved scope \`stardesk\`.
3. ${scope === "stardesk" ? "Kør Playwright pipeline (eller brug importeret reviewPlaywrightEvidence) **og** tjek hvert acceptkriterium i kode/URL." : "Inspicer ændrede filer / canvas — ingen Playwright."}
4. Opdater \`${WORKBOARD_DATA_JSON}\` for opgave \`"number": ${task.number}\`:
   - \`agentReviewEvidence.status\`: \`passed\` | \`failed\` (kun \`passed\` hvis **alle** AC er passed eller skipped med note)
   - \`agentReviewEvidence.method\`: playwright | agent | code | canvas | hybrid | manual
   - \`agentReviewEvidence.acceptCriteria\`: array — ét objekt per punkt fra spec:
     \`{ "id": "ac-1", "text": "…", "category": "functional"|"technical", "status": "passed"|"failed"|"skipped", "method": "playwright"|"kode"|"canvas"|"manuelt", "note": "kort" }\`
   - \`agentReviewEvidence.summary\`: kort dansk (fx «8/8 AC bestået; Playwright passed»)
   - \`agentReviewEvidence.humanReviewHandoff\`: 3–6 sætninger til Jan — hvad han skal spot-tjekke (ikke filliste)
   - \`agentReviewEvidence.verifiedAt\`: ms timestamp
   - \`agentReviewEvidence.findings\`: array (tom ved passed; ved fail: hvilket AC fejlede)
   - \`agentReviewView\`: dansk narrativ med «Sådan verificeres:» + «Verificeret:» (synk fra evidence — se buildAgentReviewViewFromEvidence)
   - Append \`fieldHistory.agentReviewView\` ved manuel redigering
   - Append \`activityLog\`: action «Agent Review verifikation», detail pass/fail
5. Ved **passed**: opgaven flyttes **automatisk** til **Human Review** (eller bruger trykker «Send til Human Review»)
6. Ved **failed**: **ikke** Human Review — flyt til **In Progress** med findings / \`agentRerunReason\` hvis rework kræves

## Parallel subagents (valgfrit)
Start Task-subagents med forskellige metoder (se skill): Playwright/E2E, kode-review, canvas-review — merge til én \`agentReviewEvidence\`.

## Acceptkriterier og spec
${spec}
`;
}

function applyReviewPrepToTask(
  task: Task,
  heading: string,
  summary: string,
  skillIds: string[],
  reviewerId: string,
  actor: ActivityActor = "user",
): Task {
  const trimmedSummary = normalizeTrackedFieldValue(summary);
  const previousSummary = normalizeTrackedFieldValue(task.reviewPrepSummary);
  const at = Date.now();
  const withFields = appendFieldHistoryIfChanged(
    {
      ...task,
      reviewPrepHeading: heading.trim() || task.title,
      reviewPrepSummary: trimmedSummary,
      reviewPrepSkills: skillIds,
      reviewPrepReviewer: reviewerId,
      reviewPrepAt: at,
      reviewPrepActor: actor,
    },
    "reviewPrepSummary",
    previousSummary,
    trimmedSummary,
    actor,
  );
  return appendTaskActivity(
    withFields,
    actor,
    "Review-forberedelse gemt",
    heading.trim() || task.title,
  );
}

function taskSearchHaystack(task: Task): string {
  return `${task.title} ${task.tags} ${task.description}`.toLowerCase();
}

type RouteInferenceRule = {
  path: string;
  label: string;
  test: (hay: string) => boolean;
};

const ROUTE_INFERENCE_RULES: RouteInferenceRule[] = [
  {
    path: "/portal/knowledge",
    label: "Åbn portal-viden",
    test: (h) => /portal.*knowledge|portal-v2.*kategori/.test(h),
  },
  {
    path: "/portal",
    label: "Åbn portalen",
    test: (h) => /portal|borger|selvbetjening/.test(h),
  },
  {
    path: "/aktiver",
    label: "Åbn Aktiver-siden",
    test: (h) => /aktiver|asset/.test(h),
  },
  {
    path: "/kanban",
    label: "Åbn kanban",
    test: (h) => /\bkanban\b/.test(h) && !/work board|workboard/.test(h),
  },
  {
    path: "/tickets/new",
    label: "Åbn Ny sag",
    test: (h) => /layout|ny sag|tickets\/new|create-ticket|page-layout/.test(h),
  },
  {
    path: "/tickets/major",
    label: "Åbn store sager",
    test: (h) => /major|stor-sag/.test(h),
  },
  {
    path: "/users",
    label: "Åbn brugeradministration",
    test: (h) => /bruger|users|administration/.test(h),
  },
  {
    path: "/admin/dashboard",
    label: "Åbn admin",
    test: (h) => /admin\/dashboard|admin dashboard/.test(h),
  },
  {
    path: "/login",
    label: "Åbn login",
    test: (h) => /auth|password|login|keycloak|skift-adgangskode/.test(h),
  },
  {
    path: "/knowledge",
    label: "Åbn vidensbase",
    test: (h) => /knowledge|vidensbase/.test(h) && !/portal/.test(h),
  },
  {
    path: "/service-desk",
    label: "Åbn service desk",
    test: (h) => /service-desk|service desk/.test(h),
  },
  {
    path: "/tickets",
    label: "Åbn sag-liste",
    test: (h) =>
      /ticket|sag|hover|attachments|images|cpr|stakeholder|mention|vedhæft|routing|gruppe|assignment/.test(
        h,
      ),
  },
  {
    path: "/",
    label: "Tjek sidebar i staff-app",
    test: (h) => /sidebar|nav\b|wire-sidebar/.test(h),
  },
];

function inferReviewVerificationUrl(task: Task): { url: string; label: string } {
  const hay = taskSearchHaystack(task);
  const ticketUuid =
    hay.match(
      /\/tickets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1] ??
    hay.match(
      /\bticket[_-]?(?:id|uuid)[=:\s]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1];

  if (ticketUuid) {
    return {
      url: `${STARDESK_WEB_BASE_URL}/tickets/${ticketUuid}`,
      label: "Åbn sagen",
    };
  }

  for (const rule of ROUTE_INFERENCE_RULES) {
    if (rule.test(hay)) {
      return { url: `${STARDESK_WEB_BASE_URL}${rule.path}`, label: rule.label };
    }
  }

  return { url: `${STARDESK_WEB_BASE_URL}/`, label: "Se ændring på STARDESK" };
}

function scoreByKeywords(haystack: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  let score = 0;
  for (const keyword of keywords) {
    if (keyword && haystack.includes(keyword.toLowerCase())) score += 1;
  }
  return score;
}

function suggestReviewSkills(task: Task): ReviewSkillEntry[] {
  const hay = taskSearchHaystack(task);
  const scored = REVIEW_SKILL_CATALOG.map((entry) => ({
    entry,
    score: scoreByKeywords(hay, entry.keywords),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    const fallback = REVIEW_SKILL_CATALOG.find((e) => e.id === "react-best-practices");
    return fallback ? [fallback] : [REVIEW_SKILL_CATALOG[0]!];
  }
  return scored.slice(0, 3).map((row) => row.entry);
}

function suggestReviewer(task: Task): ReviewerEntry {
  const hay = taskSearchHaystack(task);
  const scored = REVIEWER_CATALOG.map((entry) => ({
    entry,
    score: scoreByKeywords(hay, entry.keywords),
  })).sort((a, b) => b.score - a.score);
  if (scored[0]?.score) return scored[0].entry;
  return REVIEWER_CATALOG.find((e) => e.id === "fullstack") ?? REVIEWER_CATALOG[0]!;
}

function getReviewPrep(task: Task): {
  heading: string;
  summary: string | null;
  skills: string[];
  reviewer: string | null;
  reviewerLabel: string | null;
  at: number | null;
  agentStartedAt: number | null;
} {
  const reviewerEntry = task.reviewPrepReviewer
    ? REVIEWER_CATALOG.find((e) => e.id === task.reviewPrepReviewer)
    : null;
  return {
    heading: task.reviewPrepHeading?.trim() || task.title,
    summary: task.reviewPrepSummary?.trim() || null,
    skills: task.reviewPrepSkills ?? [],
    reviewer: task.reviewPrepReviewer ?? null,
    reviewerLabel: reviewerEntry?.label ?? task.reviewPrepReviewer ?? null,
    at: task.reviewPrepAt ?? null,
    agentStartedAt: task.reviewPrepAgentStartedAt ?? null,
  };
}

function hasReviewPrepReady(task: Task, draftSummary?: string): boolean {
  const summary = (draftSummary ?? task.reviewPrepSummary ?? "").trim();
  return summary.length >= 40;
}

function getReviewerById(id: string): ReviewerEntry | undefined {
  return REVIEWER_CATALOG.find((e) => e.id === id);
}

function getSkillById(id: string): ReviewSkillEntry | undefined {
  return REVIEW_SKILL_CATALOG.find((e) => e.id === id);
}

function buildReviewPrepPrompt(task: Task): string {
  const skills = suggestReviewSkills(task);
  const reviewer = suggestReviewer(task);
  const specIdx = task.description.indexOf(SPEC_MARKER);
  const spec =
    specIdx >= 0 ? task.description.slice(specIdx) : task.description.slice(0, 4000);
  const skillLines = skills
    .map((s) => `- **${s.label}** (\`${s.id}\`): \`${s.path}\``)
    .join("\n");
  const catalogSkills = REVIEW_SKILL_CATALOG.map(
    (s) => `- \`${s.id}\` — ${s.label}: \`${s.path}\``,
  ).join("\n");
  const catalogReviewers = REVIEWER_CATALOG.map(
    (r) => `- \`${r.id}\` — ${r.label}: ${r.focus}`,
  ).join("\n");

  return `# Work Board #${task.number} — REVIEW-FORBEREDELSE (før Review)

Du er **review-forberedelses-agent**. Implementeringen er klar til review — du skal **ikke** flytte opgaven til Review endnu.

## Opgave
${task.title} (\`${task.id}\`)

## Prioritet
${task.priority}

## Foreslåede review-skills (board-matcher)
${skillLines}

## Foreslået reviewer
- **${reviewer.label}** (\`${reviewer.id}\`): ${reviewer.focus}

## Din opgave
1. Læs de relevante skills (stier i kataloget) og gennemgå leverancen som den valgte reviewer.
2. Skriv en **flydende dansk begrundelse** for hvorfor opgaven kan gå i Review (mindst 4–8 sætninger): hvad der er leveret, hvordan acceptkriterier er opfyldt, og hvad reviewer bør fokusere på.
3. Opdater \`${WORKBOARD_DATA_JSON}\` for opgave \`"number": ${task.number}\` / \`"id": "${task.id}"\`:
   - \`"reviewPrepHeading"\`: kort overskrift
   - \`"reviewPrepSummary"\`: flydende begrundelse (obligatorisk)
   - \`"reviewPrepSkills"\`: array af skill-id (fx ${JSON.stringify(skills.map((s) => s.id))})
   - \`"reviewPrepReviewer"\`: \`"${reviewer.id}"\` (eller bedre match fra katalog)
   - \`"reviewPrepAt"\`: ${Date.now()}
   - \`"reviewPrepAgentStartedAt"\`: behold eller sæt tidsstempel
4. **Flyt IKKE** til \`"status": "Review"\` — det sker først når kasse «Review-forberedelse» nederst i åben sag er udfyldt og brugeren/agent trykker «Klar til review» (eller implementerings-agenten efter genkørsel).
5. Append til \`activityLog\`: \`{ "at": <ms>, "actor": "agent", "action": "...", "detail": "..." }\` — **altid** dato/tid og aktør **agent** (brugeren vises som **Dig** i UI).

## Skill-katalog (vælg relevante)
${catalogSkills}

## Reviewer-katalog
${catalogReviewers}

## Spec og acceptkriterier
${spec}
`;
}

function buildKodeklarAgentPrompt(task: Task): string {
  const skills = suggestReviewSkills(task);
  const skillLines = skills
    .map((s) => `- **${s.label}** (\`${s.id}\`): \`${s.path}\``)
    .join("\n");
  const tagHint = task.tags.trim()
    ? `Tags: ${task.tags}`
    : "Ingen tags — udled scope fra titel.";
  const intro = stripDescriptionWorkflowNoise(task.description);

  return `# Work Board #${task.number} — KODEKLAR SPEC

Du er **kodeklar-agent**. Opgaven skal gøres kodningsklar **før** Refinement og implementering.

## Opgave
${task.title} (\`${task.id}\`)

## Prioritet
${task.priority}

## ${tagHint}

## Foreslåede kompetencer (tags/titel)
${skillLines}

## Din opgave
1. Skriv eller forbedre **kodningsklar spec** i \`description\` med præcis denne markør:
   \`${SPEC_MARKER}\`
2. Spec skal indeholde sektioner: **Mål**, **Scope**, **Output**, **Acceptkriterier** (dansk, konkret).
3. Behold evt. intro-tekst **over** markøren; workflow-støj (Review-afvisning osv.) må ikke overskrives — kun spec-delen.
4. Opdater \`${WORKBOARD_DATA_JSON}\` for \`"number": ${task.number}\` / \`"id": "${task.id}"\`:
   - \`"description"\`: fuld tekst med spec-markør
   - **Append-only** \`fieldHistory.description\`: tilføj ny entry med \`at\`, \`actor\`: \`"agent"\`, \`value\` — **aldrig** erstat hele array
   - Append \`activityLog\`: \`{ "at": <ms>, "actor": "agent", "action": "Kodningsklar spec udfyldt", "detail": "<kort>" }\`
5. **Flyt til Refinement:** Sæt \`"status": "Refinement"\` og log \`{ "action": "Flyttet til Refinement", ... }\`.
6. **Start IKKE** implementering — det sker først i I gang efter Ready.

## Eksisterende beskrivelse (udgangspunkt)
${intro || "(tom — skriv spec fra titel og tags)"}
`;
}

function buildRefinementAgentPrompt(task: Task): string {
  const skills = suggestReviewSkills(task);
  const reviewer = suggestReviewer(task);
  const specIdx = task.description.indexOf(SPEC_MARKER);
  const spec =
    specIdx >= 0 ? task.description.slice(specIdx) : task.description.slice(0, 4000);
  const skillLines = skills
    .map((s) => `- **${s.label}** (\`${s.id}\`): \`${s.path}\``)
    .join("\n");
  const catalogSkills = REVIEW_SKILL_CATALOG.map(
    (s) => `- \`${s.id}\` — ${s.label}: \`${s.path}\``,
  ).join("\n");

  return `# Work Board #${task.number} — REFINEMENT (agent-plan)

Du er **refinement/plan-agent**. Kodningsklar spec findes — skriv **implementeringsplan** (\`agentPlan\`).

## Opgave
${task.title} (\`${task.id}\`)

## Prioritet
${task.priority}

## Matchende skills (læs relevante)
${skillLines}

## Foreslået reviewer-kontekst
- **${reviewer.label}** (\`${reviewer.id}\`): ${reviewer.focus}

## Din opgave
1. Læs spec og relevante skills (mønster: \`stardesk-workboard-review-prep\` skill).
2. Skriv \`agentPlan\`: konkrete implementeringstrin på dansk (**min. ${AGENT_PLAN_MIN_LEN} tegn**).
3. Opdater \`${WORKBOARD_DATA_JSON}\`:
   - \`"agentPlan"\`, \`"agentPlanAt"\`, \`"agentPlanActor"\`: \`"agent"\`
   - **Append-only** \`fieldHistory.agentPlan\` — aldrig overskriv eksisterende entries
   - Append \`activityLog\`: \`{ "at": <ms>, "actor": "agent", "action": "Plan udfyldt", "detail": "<kort>" }\`
4. **Flyt til Ready:** Sæt \`"status": "Ready"\` når plan opfylder min. længde; log \`{ "action": "Flyttet til Ready", ... }\`.
5. **Flyt IKKE** til I gang — ready-agent bekræfter først.

## Skill-katalog
${catalogSkills}

## Kodningsklar spec
${spec}
`;
}

function buildReadyToInProgressPrompt(task: Task): string {
  const specIdx = task.description.indexOf(SPEC_MARKER);
  const spec =
    specIdx >= 0 ? task.description.slice(specIdx) : task.description.slice(0, 4000);
  const plan = task.agentPlan?.trim() ?? "";

  return `# Work Board #${task.number} — KLAR TIL IMPLEMENTERING

Du er **ready-agent**. Bekræft at opgaven er klar til **I gang** (implementering).

## Opgave
${task.title} (\`${task.id}\`)

## Gates (skal opfyldes)
- Kodningsklar spec: ${hasKodeklarSpec(task) ? "✓" : "✗"}
- Agent-plan (min. ${AGENT_PLAN_MIN_LEN} tegn): ${hasAgentPlanReady(task) ? "✓" : "✗"}

## Din opgave
1. Verificér spec og \`agentPlan\` er komplette og konsistente.
2. Hvis noget mangler: udfyld spec eller plan først (append \`fieldHistory\` + \`activityLog\`).
3. Når gates er opfyldt:
   - Sæt \`"status": "In Progress"\`
   - Append \`activityLog\`: \`{ "at": <ms>, "actor": "agent", "action": "Flyttet til I gang", "detail": "Klar til implementering" }\`
4. **Implementér derefter** i STARdesk repo — Work Board åbner implementerings-agent automatisk ved I gang.

## Spec
${spec}

## Agent-plan
${plan || "(mangler — skriv plan før flyt)"}
`;
}

type ReviewDeliveryDraft = {
  heading: string;
  summary: string;
  verificationUrl: string;
  verificationLabel: string;
  verificationScope: ReviewVerificationScope;
};

function ReviewVerificationLinkBlock({
  task,
  theme,
  compact = false,
  scopeOverride,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
  compact?: boolean;
  scopeOverride?: ReviewVerificationScope;
}) {
  const delivery = getReviewDelivery(task);
  const scope = scopeOverride ?? delivery.verificationScope;
  const url = delivery.verificationUrl;
  const label = url ? resolveVerificationLabel(url, delivery.verificationLabel) : null;

  if (scope === "none") return null;

  if (scope === "cursor") {
    return (
      <Stack
        gap={6}
        style={{
          border: `1px solid ${theme.stroke.primary}`,
          borderRadius: 8,
          padding: compact ? 10 : 12,
          background: theme.bg.elevated,
        }}
      >
        <Text weight="semibold" style={{ fontSize: compact ? 13 : 14 }}>
          Verifikation
        </Text>
        <Text size="small" tone="secondary">
          {REVIEW_VERIFICATION_CURSOR_NOTE}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack
      gap={6}
      style={{
        border: `1px solid ${theme.stroke.primary}`,
        borderRadius: 8,
        padding: compact ? 10 : 12,
        background: theme.bg.elevated,
      }}
    >
      <Text weight="semibold" style={{ fontSize: compact ? 13 : 14 }}>
        Verifikationslink
      </Text>
      {url ? (
        <Stack gap={6}>
          <Text size="small" tone="secondary">
            Åbn STARDESK og verificér ændringen manuelt før godkendelse.
          </Text>
          <Row gap={8} align="center" wrap>
            <Button variant="primary" onClick={() => openVerificationUrl(url)}>
              {label}
            </Button>
            <Text
              size="small"
              tone="tertiary"
              style={{ wordBreak: "break-all", flex: 1, minWidth: 0 }}
            >
              {url}
            </Text>
          </Row>
        </Stack>
      ) : (
        <Text size="small" tone="secondary">
          Intet verifikationslink — udfyld under Leverance til review.
        </Text>
      )}
    </Stack>
  );
}

function ReviewDeliveryViewPanel({
  task,
  theme,
  compact = false,
  showVerification = true,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
  /** Compact read-only summary for Review column cards. */
  compact?: boolean;
  showVerification?: boolean;
}) {
  const delivery = getReviewDelivery(task);
  const when = formatReviewDeliveryWhen(delivery.at);
  const hasContent = Boolean(delivery.summary?.trim() || delivery.heading?.trim());

  if (compact) {
    if (!hasContent) return null;
    const summaryText = delivery.summary?.trim() ?? "";
    const summaryPreview =
      summaryText.length > 140 ? `${summaryText.slice(0, 140).trim()}…` : summaryText;

    return (
      <Stack gap={4}>
        {delivery.heading?.trim() ? (
          <Text weight="semibold" size="small" style={{ lineHeight: 1.35 }}>
            {delivery.heading}
          </Text>
        ) : null}
        {summaryPreview ? (
          <Text
            size="small"
            tone="secondary"
            style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}
          >
            {summaryPreview}
          </Text>
        ) : null}
        {when ? (
          <Text size="small" tone="tertiary">
            {when} · {formatActivityActor(delivery.actor)}
          </Text>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack
      gap={10}
      style={{
        border: `1px solid ${theme.stroke.primary}`,
        borderRadius: 8,
        padding: 16,
        background: theme.fill.secondary,
      }}
    >
      <Stack gap={4}>
        <Text weight="semibold" style={{ fontSize: 17, lineHeight: 1.35 }}>
          {delivery.heading}
        </Text>
        {when ? (
          <Text size="small" tone="tertiary">
            Leverance · {when} · {formatActivityActor(delivery.actor)}
          </Text>
        ) : null}
      </Stack>
      {delivery.summary ? (
        <Text size="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
          {delivery.summary}
        </Text>
      ) : null}
      {showVerification ? <ReviewVerificationLinkBlock task={task} theme={theme} /> : null}
    </Stack>
  );
}

type PasteCaptureEvent = {
  clipboardData: DataTransfer | null;
  preventDefault: () => void;
  stopPropagation: () => void;
};

function ReviewRejectAttachmentThumb({
  attachment,
  theme,
  onRemove,
  readOnly = false,
}: {
  attachment: ReviewRejectAttachment;
  theme: ReturnType<typeof useHostTheme>;
  onRemove?: () => void;
  readOnly?: boolean;
}) {
  const isVideo = attachment.kind === "video";
  return (
    <Stack
      gap={4}
      style={{
        border: `1px solid ${theme.stroke.primary}`,
        borderRadius: 8,
        padding: 6,
        background: theme.bg.elevated,
        maxWidth: isVideo ? 220 : 160,
      }}
    >
      {isVideo ? (
        <video
          src={attachment.dataUrl}
          controls
          preload="metadata"
          style={{
            display: "block",
            width: "100%",
            maxHeight: 120,
            borderRadius: 4,
            background: theme.fill.secondary,
          }}
        />
      ) : (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          style={{
            display: "block",
            width: "100%",
            maxHeight: 96,
            objectFit: "contain",
            borderRadius: 4,
          }}
        />
      )}
      <Row gap={4} align="center">
        <Text
          size="small"
          tone="tertiary"
          style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {isVideo ? "Video: " : ""}
          {attachment.name}
        </Text>
        {!readOnly && onRemove ? (
          <IconButton
            title={isVideo ? "Fjern video" : "Fjern billede"}
            size="sm"
            onClick={onRemove}
          >
            ✕
          </IconButton>
        ) : null}
      </Row>
    </Stack>
  );
}

function ReviewRejectAttachmentsDisplay({
  attachments,
  theme,
}: {
  attachments: ReviewRejectAttachment[];
  theme: ReturnType<typeof useHostTheme>;
}) {
  if (attachments.length === 0) return null;
  const { images, videos } = countReviewRejectAttachments(attachments);
  const label =
    images > 0 && videos > 0
      ? `Vedhæftninger fra afvisning (${images} billede(r), ${videos} video(er))`
      : videos > 0
        ? `Video fra afvisning (${videos})`
        : `Skærmbilleder fra afvisning (${images})`;
  return (
    <Stack gap={6}>
      <Text size="small" weight="semibold">
        {label}
      </Text>
      <Row gap={8} wrap>
        {attachments.map((attachment) => (
          <ReviewRejectAttachmentThumb
            key={attachment.id}
            attachment={attachment}
            theme={theme}
            readOnly
          />
        ))}
      </Row>
    </Stack>
  );
}

function ReviewRejectReasonField({
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  onAttachmentError,
  theme,
}: {
  value: string;
  onChange: (value: string) => void;
  attachments: ReviewRejectAttachment[];
  onAttachmentsChange: (next: ReviewRejectAttachment[]) => void;
  onAttachmentError?: (message: string) => void;
  theme: ReturnType<typeof useHostTheme>;
}) {
  async function appendAttachmentFromFile(
    current: ReviewRejectAttachment[],
    file: File,
    kind: ReviewRejectAttachmentKind,
  ): Promise<{ next: ReviewRejectAttachment[]; error?: string }> {
    const maxBytes =
      kind === "video" ? REVIEW_REJECT_VIDEO_MAX_BYTES : REVIEW_REJECT_IMAGE_MAX_BYTES;
    const maxCount =
      kind === "video" ? REVIEW_REJECT_VIDEO_MAX_COUNT : REVIEW_REJECT_IMAGE_MAX_COUNT;
    const { images, videos } = countReviewRejectAttachments(current);
    const currentCount = kind === "video" ? videos : images;

    if (currentCount >= maxCount) {
      return {
        next: current,
        error:
          kind === "video"
            ? `Maks. ${REVIEW_REJECT_VIDEO_MAX_COUNT} videoer.`
            : `Maks. ${REVIEW_REJECT_IMAGE_MAX_COUNT} skærmbilleder.`,
      };
    }

    let dataUrl: string;
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch {
      return {
        next: current,
        error: kind === "video" ? "Kunne ikke læse videoen." : "Kunne ikke læse billedet.",
      };
    }

    if (estimateDataUrlBytes(dataUrl) > maxBytes) {
      return {
        next: current,
        error:
          kind === "video"
            ? "Videoen er for stor (maks. 20 MB)."
            : "Billedet er for stort (maks. 500 KB).",
      };
    }

    const at = Date.now();
    const prefix = kind === "video" ? "reject-vid" : "reject-img";
    const fallbackName = kind === "video" ? `video-${at}.mp4` : `screenshot-${at}.png`;
    const name = file.name?.trim() || fallbackName;
    return {
      next: [
        ...current,
        { id: `${prefix}-${at}`, kind, dataUrl, name, at },
      ],
    };
  }

  async function handlePasteCapture(event: PasteCaptureEvent) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const imageItem = Array.from(clipboard.items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    event.preventDefault();
    event.stopPropagation();

    const file = imageItem.getAsFile();
    if (!file) return;
    const result = await appendAttachmentFromFile(attachments, file, "image");
    if (result.error) onAttachmentError?.(result.error);
    else onAttachmentsChange(result.next);
  }

  async function handleFileInputChange(event: { target: EventTarget | null }) {
    const input = event.target as HTMLInputElement | null;
    const fileList = input?.files;
    if (!fileList?.length) return;

    let next = attachments;
    for (const file of Array.from(fileList)) {
      let kind: ReviewRejectAttachmentKind | null = null;
      if (isReviewRejectVideoFile(file)) kind = "video";
      else if (isReviewRejectImageFile(file)) kind = "image";
      else {
        onAttachmentError?.(
          "Filen skal være et billede (PNG/JPG) eller video (MP4, WebM, MOV).",
        );
        continue;
      }
      const result = await appendAttachmentFromFile(next, file, kind);
      if (result.error) onAttachmentError?.(result.error);
      next = result.next;
    }
    onAttachmentsChange(next);

    if (input) input.value = "";
  }

  function openFilePicker() {
    document.getElementById(REVIEW_REJECT_FILE_INPUT_ID)?.click();
  }

  return (
    <Stack gap={6}>
      <Text size="small" tone="tertiary">
        Du kan indsætte skærmbilleder med Ctrl+V eller uploade billede/video (maks.{" "}
        {REVIEW_REJECT_IMAGE_MAX_COUNT} billeder à 500 KB, {REVIEW_REJECT_VIDEO_MAX_COUNT} videoer à
        20 MB).
      </Text>
      <Row gap={8} wrap align="center">
        <input
          id={REVIEW_REJECT_FILE_INPUT_ID}
          type="file"
          accept={REVIEW_REJECT_FILE_ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={(event) => void handleFileInputChange(event)}
        />
        <Button variant="secondary" onClick={openFilePicker}>
          Upload fil
        </Button>
      </Row>
      <div onPasteCapture={(event) => void handlePasteCapture(event)}>
        <TextArea
          rows={3}
          value={value}
          onChange={onChange}
          placeholder="Hvad skal rettes eller gentages?"
        />
      </div>
      {attachments.length > 0 ? (
        <Row gap={8} wrap>
          {attachments.map((attachment) => (
            <ReviewRejectAttachmentThumb
              key={attachment.id}
              attachment={attachment}
              theme={theme}
              onRemove={() =>
                onAttachmentsChange(attachments.filter((entry) => entry.id !== attachment.id))
              }
            />
          ))}
        </Row>
      ) : null}
    </Stack>
  );
}

function ReviewPanel({
  task,
  theme,
  draft,
  onDraftChange,
  deliveryReady,
  showRequiredHint,
  autoSaveStatus = "idle",
  agentReviewViewDraft = "",
  onAgentReviewViewChange,
  agentReviewViewAutoSaveStatus = "idle",
  openPickerId,
  setOpenPickerId,
  reviewActionsMode = null,
  reviewStage,
  stageActive = true,
  readOnly = false,
  reviewRejectOpen = false,
  reviewRejectReason = "",
  reviewRejectAttachments = [],
  onReviewRejectReasonChange,
  onReviewRejectAttachmentsChange,
  onReviewRejectAttachmentError,
  onApprove,
  onRejectToggle,
  onRejectCancel,
  onRejectConfirm,
  agentPlan,
  agentReviewGate,
  onStartAgentReview,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
  draft: ReviewDeliveryDraft;
  onDraftChange: (next: ReviewDeliveryDraft) => void;
  deliveryReady: boolean;
  showRequiredHint: boolean;
  autoSaveStatus?: AutoSaveStatus;
  agentReviewViewDraft?: string;
  onAgentReviewViewChange?: (value: string) => void;
  agentReviewViewAutoSaveStatus?: AutoSaveStatus;
  openPickerId: string | null;
  setOpenPickerId: (id: string | null) => void;
  reviewActionsMode?: "agent" | "human" | null;
  /** When set, this panel is one of the dual review stage boxes. */
  reviewStage?: "agent" | "human";
  /** False = collapsed guide box (inactive stage in dual layout). */
  stageActive?: boolean;
  readOnly?: boolean;
  reviewRejectOpen?: boolean;
  reviewRejectReason?: string;
  reviewRejectAttachments?: ReviewRejectAttachment[];
  onReviewRejectReasonChange?: (value: string) => void;
  onReviewRejectAttachmentsChange?: (attachments: ReviewRejectAttachment[]) => void;
  onReviewRejectAttachmentError?: (message: string) => void;
  onApprove?: () => void;
  onRejectToggle?: () => void;
  onRejectCancel?: () => void;
  onRejectConfirm?: () => void;
  agentPlan?: string;
  agentReviewGate?: AgentReviewVerificationGate | null;
  onStartAgentReview?: () => void;
}) {
  const stored = getReviewDelivery(task);
  const when = formatReviewDeliveryWhen(stored.at);
  const scope = draft.verificationScope;
  const effectiveActionsMode: "agent" | "human" | null =
    reviewStage && stageActive
      ? reviewStage
      : reviewActionsMode;
  const showDeliveryHeadingField =
    !effectiveActionsMode &&
    !GENERIC_DELIVERY_HEADINGS.has(draft.heading.trim()) &&
    Boolean(draft.heading.trim());
  const panelTitle = reviewStage
    ? reviewStage === "human"
      ? "Human Review"
      : "Agent Review"
    : effectiveActionsMode === "human"
      ? "Human Review"
      : effectiveActionsMode === "agent"
        ? "Agent Review"
        : "Leverance til review";
  const panelHint = reviewStage
    ? REVIEW_STAGE_HINTS[reviewStage]
    : effectiveActionsMode === "human"
      ? REVIEW_STAGE_HINTS.human
      : effectiveActionsMode === "agent"
        ? `${REVIEW_STAGE_HINTS.agent} ${REVIEW_DELIVERY_JAN_GUIDE}`
        : showRequiredHint
          ? scope === "stardesk"
            ? `Obligatorisk før Agent Review. ${REVIEW_DELIVERY_JAN_GUIDE} Angiv STARDESK-URL til verifikation.`
            : `Obligatorisk før Agent Review. ${REVIEW_DELIVERY_JAN_GUIDE}`
          : readOnly
            ? "Leverance og verifikation (læs-only)."
            : "Rediger leverance og verifikation — ændringer gemmes automatisk.";
  const showStardeskUrlFields = scope === "stardesk";
  const rawPreviewUrl = showStardeskUrlFields
    ? (draft.verificationUrl.trim() || stored.verificationUrl || "").trim()
    : "";
  const normalizedPreviewUrl = rawPreviewUrl ? normalizeVerificationUrl(rawPreviewUrl) : null;
  const previewLabel = draft.verificationLabel.trim() || stored.verificationLabel || null;
  const needsAttention = showRequiredHint && !deliveryReady;
  const showAgentReviewView =
    effectiveActionsMode === "agent" ||
    effectiveActionsMode === "human" ||
    reviewStage != null ||
    Boolean(task.agentReviewView?.trim());
  const agentReviewViewText =
    agentReviewViewDraft.trim() || task.agentReviewView?.trim() || "";
  const evidenceStatus = task.agentReviewEvidence?.status;
  const isCollapsedStage = reviewStage != null && !stageActive;
  const showVerificationFields = reviewStage == null || reviewStage === "agent";

  if (isCollapsedStage) {
    return (
      <Card
        style={{
          opacity: 0.72,
          borderColor: theme.stroke.tertiary,
        }}
      >
        <div
          style={{
            background: theme.fill.secondary,
            borderBottom: `1px solid ${theme.stroke.tertiary}`,
          }}
        >
          <CardHeader>{panelTitle}</CardHeader>
        </div>
        <CardBody>
          <Stack gap={8}>
            <Text size="small" tone="secondary">
              {panelHint}
            </Text>
            {reviewStage === "human" ? (
              <Text size="small" tone="tertiary">
                Afventer at Agent Review bestås — derefter kan du godkende eller afvise her.
              </Text>
            ) : evidenceStatus ? (
              <Text size="small" tone="secondary">
                {AGENT_REVIEW_EVIDENCE_STATUS_LABEL[evidenceStatus]}
                {task.agentReviewEvidence?.method
                  ? ` · ${AGENT_REVIEW_METHOD_LABEL[task.agentReviewEvidence.method]}`
                  : ""}
              </Text>
            ) : null}
          </Stack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card
      style={{
        borderColor: needsAttention ? theme.stroke.primary : undefined,
        borderWidth: needsAttention ? 2 : undefined,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: theme.fill.secondary,
          borderBottom: `1px solid ${theme.stroke.tertiary}`,
        }}
      >
        <CardHeader
          trailing={
            when
              ? `${when} · ${formatActivityActor(stored.actor)}`
              : needsAttention
                ? "Påkrævet"
                : undefined
          }
        >
          {panelTitle}
        </CardHeader>
      </div>
      <CardBody>
        <Stack gap={14}>
          <Text size="small" tone="secondary">
            {panelHint}
            {effectiveActionsMode ? " Ændringer gemmes automatisk." : ""}
          </Text>

          <Stack gap={6}>
            {showDeliveryHeadingField ? (
              <>
                <Text size="small" weight="semibold">
                  Overskrift
                </Text>
                {readOnly ? (
                  <Text size="small" style={{ whiteSpace: "pre-wrap" }}>
                    {draft.heading.trim() || stored.heading || "—"}
                  </Text>
                ) : (
                  <TextInput
                    value={draft.heading}
                    onChange={(value) => onDraftChange({ ...draft, heading: value })}
                    placeholder="Kort overskrift på leverancen"
                  />
                )}
                <Divider />
              </>
            ) : null}

            <Stack gap={2}>
              <Text size="small" weight="semibold" style={{ letterSpacing: "0.04em" }}>
                LEVERANCE
              </Text>
              <Text size="small" tone="secondary">
                {effectiveActionsMode
                  ? "Konkret gennemført arbejde — filer, features og hvordan det verificeres."
                  : "Beskriv hvad der er lavet — konkrete filer, funktioner og hvordan det verificeres (min. 80 tegn)."}
              </Text>
            </Stack>
            {readOnly || effectiveActionsMode === "human" ? (
              <Text size="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {draft.summary.trim() || stored.summary || "—"}
              </Text>
            ) : (
              <TextArea
                rows={reviewDeliveryTextAreaRows(draft.summary)}
                value={draft.summary}
                onChange={(value) => onDraftChange({ ...draft, summary: value })}
                placeholder="Hvad er gennemført? Fx ændrede filer, API-endpoints, UI-flows og verifikationstrin."
              />
            )}
            <CollapsibleVersionHistory
              entries={task.fieldHistory?.reviewDeliverySummary ?? []}
              theme={theme}
            />
          </Stack>

          {showAgentReviewView ? (
            <>
              <Divider />
              <Stack gap={6}>
                <Stack gap={2}>
                  <Text size="small" weight="semibold" style={{ letterSpacing: "0.04em" }}>
                    AGENT VIEW
                  </Text>
                  <Text size="small" tone="secondary">
                    Verifikationsplan og resultater — synkroniseres fra agentReviewEvidence.
                  </Text>
                </Stack>
                {readOnly || effectiveActionsMode === "human" ? (
                  <Text size="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {agentReviewViewText || "—"}
                  </Text>
                ) : (
                  <TextArea
                    rows={reviewDeliveryTextAreaRows(agentReviewViewText)}
                    value={agentReviewViewDraft}
                    onChange={(value) => onAgentReviewViewChange?.(value)}
                    placeholder={`${AGENT_REVIEW_VIEW_PLAN_MARKER}\nMetode og trin…\n\n${AGENT_REVIEW_VIEW_DONE_MARKER}\nHvad er verificeret…`}
                  />
                )}
                <CollapsibleVersionHistory
                  entries={task.fieldHistory?.agentReviewView ?? []}
                  theme={theme}
                />
              </Stack>
            </>
          ) : null}

          {showVerificationFields ? (
          <>
          <Divider />

          <Stack gap={8}>
            <Stack gap={2}>
              <Text size="small" weight="semibold">
                Verifikation scope
              </Text>
              <Text size="small" tone="secondary">
                Vælg om reviewer skal åbne deployed STARDESK eller kun se ændringen her i Cursor.
              </Text>
            </Stack>
            <ThemedPicker
              pickerId={`verification-scope-${task.id}`}
              openPickerId={openPickerId}
              setOpenPickerId={setOpenPickerId}
              value={scope}
              onChange={(value) =>
                onDraftChange({
                  ...draft,
                  verificationScope: value as ReviewVerificationScope,
                })
              }
              options={VERIFICATION_SCOPE_OPTIONS}
              theme={theme}
              style={{ maxWidth: 360 }}
              disabled={readOnly || effectiveActionsMode === "human"}
            />
            {scope === "cursor" ? (
              <Text size="small" tone="secondary">
                {REVIEW_VERIFICATION_CURSOR_NOTE}
              </Text>
            ) : null}
            {showStardeskUrlFields ? (
              <>
                <Stack gap={4}>
                  <Text size="small" tone="tertiary">
                    Verifikationslink
                  </Text>
                  {readOnly ? (
                    normalizedPreviewUrl ? (
                      <Text size="small" style={{ wordBreak: "break-all" }}>
                        {normalizedPreviewUrl}
                      </Text>
                    ) : (
                      <Text size="small" tone="secondary">
                        Intet link angivet
                      </Text>
                    )
                  ) : (
                    <>
                      <Text size="small" tone="secondary">
                        Fuld URL til den side i STARDESK hvor ændringen verificeres.
                      </Text>
                      <TextInput
                        value={draft.verificationUrl}
                        onChange={(value) => onDraftChange({ ...draft, verificationUrl: value })}
                        placeholder={`${STARDESK_WEB_BASE_URL}/aktiver`}
                      />
                      <Row gap={6} wrap>
                        {VERIFICATION_QUICK_PICKS.map((pick) => (
                          <Button
                            key={pick.path}
                            variant="ghost"
                            onClick={() =>
                              onDraftChange({
                                ...draft,
                                verificationUrl: `${STARDESK_WEB_BASE_URL}${pick.path}`,
                                verificationLabel: pick.label,
                              })
                            }
                          >
                            {pick.shortLabel}
                          </Button>
                        ))}
                      </Row>
                    </>
                  )}
                </Stack>
                {!readOnly ? (
                  <Stack gap={4}>
                    <Text size="small" tone="tertiary">
                      Linktekst (valgfri)
                    </Text>
                    <TextInput
                      value={draft.verificationLabel}
                      onChange={(value) => onDraftChange({ ...draft, verificationLabel: value })}
                      placeholder="Åbn Aktiver-siden"
                    />
                  </Stack>
                ) : previewLabel ? (
                  <Text size="small" tone="secondary">
                    Linktekst: {previewLabel}
                  </Text>
                ) : null}
                {normalizedPreviewUrl ? (
                  <Stack
                    gap={6}
                    style={{
                      border: `1px solid ${theme.stroke.primary}`,
                      borderRadius: 8,
                      padding: 12,
                      background: theme.bg.elevated,
                    }}
                  >
                    <Text size="small" tone="secondary">
                      Forhåndsvisning — sådan ser linket ud for reviewer
                    </Text>
                    <Row gap={8} align="center" wrap>
                      <Button
                        variant="secondary"
                        onClick={() => openVerificationUrl(normalizedPreviewUrl)}
                      >
                        {resolveVerificationLabel(normalizedPreviewUrl, previewLabel)}
                      </Button>
                      <Text
                        size="small"
                        tone="tertiary"
                        style={{ wordBreak: "break-all", flex: 1, minWidth: 0 }}
                      >
                        {normalizedPreviewUrl}
                      </Text>
                    </Row>
                  </Stack>
                ) : rawPreviewUrl ? (
                  <Text size="small" tone="secondary">
                    {REVIEW_VERIFICATION_INVALID_MESSAGE}
                  </Text>
                ) : null}
              </>
            ) : null}
          </Stack>
          </>
          ) : null}

          {showVerificationFields
            ? (() => {
            const autoSaveHint = formatAutoSaveHint(
              autoSaveStatus,
              agentReviewViewAutoSaveStatus,
              showRequiredHint,
              deliveryReady,
            );
            return autoSaveHint ? (
              <Text
                size="small"
                tone={
                  autoSaveStatus === "saved" || agentReviewViewAutoSaveStatus === "saved"
                    ? "secondary"
                    : needsAttention
                      ? "secondary"
                      : "tertiary"
                }
                weight={
                  autoSaveStatus === "pending" || agentReviewViewAutoSaveStatus === "pending"
                    ? "semibold"
                    : undefined
                }
              >
                {autoSaveHint}
              </Text>
            ) : null;
          })()
            : null}

          {effectiveActionsMode ? (
            <>
              <Divider />
              {effectiveActionsMode === "agent" && agentReviewGate ? (
                <Stack
                  gap={6}
                  style={{
                    border: `1px solid ${
                      agentReviewGate.blocked
                        ? theme.diff.removed
                        : evidenceStatus === "passed"
                          ? theme.diff.added
                          : theme.diff.renamed
                    }`,
                    borderRadius: 8,
                    padding: 12,
                    background: theme.bg.elevated,
                  }}
                >
                  <Row gap={8} wrap align="center">
                    <Text size="small" weight="semibold">
                      {getEvidenceBannerTitle(agentReviewGate, evidenceStatus)}
                    </Text>
                    {evidenceStatus ? (
                      <Text size="small" tone="secondary">
                        {AGENT_REVIEW_EVIDENCE_STATUS_LABEL[evidenceStatus]}
                        {task.agentReviewEvidence?.method
                          ? ` · ${AGENT_REVIEW_METHOD_LABEL[task.agentReviewEvidence.method]}`
                          : ""}
                      </Text>
                    ) : null}
                  </Row>
                  {agentReviewGate.message ? (
                    <Text size="small" tone="secondary">
                      {agentReviewGate.message}
                    </Text>
                  ) : null}
                  {onStartAgentReview && evidenceStatus !== "passed" ? (
                    <Row gap={6} wrap>
                      <Button variant="secondary" type="button" onClick={onStartAgentReview}>
                        Start Agent Review-agent
                      </Button>
                    </Row>
                  ) : null}
                </Stack>
              ) : null}
              {effectiveActionsMode === "human" &&
              scope === "stardesk" &&
              !normalizedPreviewUrl ? (
                <Text size="small" tone="secondary">
                  Intet verifikationslink — tjek manuelt på STARDESK før godkendelse.
                </Text>
              ) : null}
              <Row gap={8} wrap>
                <Button
                  variant="primary"
                  disabled={effectiveActionsMode === "agent" && agentReviewGate?.blocked === true}
                  onClick={onApprove}
                >
                  {effectiveActionsMode === "agent" ? "Send til Human Review" : "Godkend"}
                </Button>
                {effectiveActionsMode === "human" ? (
                  <Button variant="secondary" onClick={onRejectToggle}>
                    Afvis
                  </Button>
                ) : null}
              </Row>
              {effectiveActionsMode === "human" && reviewRejectOpen ? (
                <Stack gap={6}>
                  {agentPlan?.trim() ? (
                    <Stack
                      gap={4}
                      style={{
                        border: `1px solid ${theme.stroke.primary}`,
                        borderRadius: 8,
                        padding: 12,
                        background: theme.bg.elevated,
                      }}
                    >
                      <Text size="small" weight="semibold">
                        Agent-plan (reference ved genkørsel)
                      </Text>
                      <Text
                        size="small"
                        style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                      >
                        {agentPlan.trim()}
                      </Text>
                    </Stack>
                  ) : null}
                  <Text size="small" tone="secondary">
                    Angiv begrundelse — opgaven sendes til I gang, og Cursor-agenten skal udføre
                    den forfra med disse kommentarer.
                  </Text>
                  <ReviewRejectReasonField
                    value={reviewRejectReason}
                    onChange={(value) => onReviewRejectReasonChange?.(value)}
                    attachments={reviewRejectAttachments}
                    onAttachmentsChange={(next) => onReviewRejectAttachmentsChange?.(next)}
                    onAttachmentError={onReviewRejectAttachmentError}
                    theme={theme}
                  />
                  <Row gap={8} wrap>
                    <Button variant="ghost" onClick={onRejectCancel}>
                      Annuller
                    </Button>
                    <Button
                      variant="primary"
                      disabled={
                        !reviewRejectReason.trim() && reviewRejectAttachments.length === 0
                      }
                      onClick={onRejectConfirm}
                    >
                      Afvis → I gang
                    </Button>
                  </Row>
                </Stack>
              ) : null}
            </>
          ) : null}
        </Stack>
      </CardBody>
    </Card>
  );
}

type ReviewPrepDraft = {
  heading: string;
  summary: string;
};

const AUTO_SAVE_DEBOUNCE_MS = 1500;
const AUTO_SAVE_SAVED_FLASH_MS = 2000;

type AutoSaveKind = "delivery" | "prep" | "plan" | "agentReviewView";
type AutoSaveStatus = "idle" | "pending" | "saved";

const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingDeliveryDrafts = new Map<string, ReviewDeliveryDraft>();
const pendingReviewPrepDrafts = new Map<string, ReviewPrepDraft>();
const pendingAgentPlanDrafts = new Map<string, string>();
const pendingAgentReviewViewDrafts = new Map<string, string>();

type AutoSaveRunners = {
  commitDelivery: (
    taskId: string,
    draft: ReviewDeliveryDraft,
    options?: { silent?: boolean; actor?: ActivityActor },
  ) => boolean;
  commitPrep: (
    taskId: string,
    draft: ReviewPrepDraft,
    options?: { silent?: boolean },
  ) => boolean;
  commitPlan: (taskId: string, plan: string, options?: { silent?: boolean }) => boolean;
  commitAgentReviewView: (
    taskId: string,
    view: string,
    options?: { silent?: boolean; actor?: ActivityActor },
  ) => boolean;
  setStatus: (taskId: string, kind: AutoSaveKind, status: AutoSaveStatus) => void;
};

let autoSaveRunners: AutoSaveRunners | null = null;

function autoSaveKey(kind: AutoSaveKind, taskId: string): string {
  return `${kind}:${taskId}`;
}

function clearAutoSaveTimer(kind: AutoSaveKind, taskId: string): void {
  const key = autoSaveKey(kind, taskId);
  const existing = autoSaveTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    autoSaveTimers.delete(key);
  }
}

function scheduleAutoSave(kind: AutoSaveKind, taskId: string, run: () => void): void {
  const key = autoSaveKey(kind, taskId);
  clearAutoSaveTimer(kind, taskId);
  autoSaveRunners?.setStatus(taskId, kind, "pending");
  autoSaveTimers.set(
    key,
    setTimeout(() => {
      autoSaveTimers.delete(key);
      run();
    }, AUTO_SAVE_DEBOUNCE_MS),
  );
}

function flushAutoSaveTimer(kind: AutoSaveKind, taskId: string): void {
  clearAutoSaveTimer(kind, taskId);
}

function deliveryDraftMatchesTask(task: Task, draft: ReviewDeliveryDraft): boolean {
  const stored = getReviewDelivery(task);
  return (
    draft.heading.trim() === stored.heading.trim() &&
    normalizeTrackedFieldValue(draft.summary) === normalizeTrackedFieldValue(stored.summary) &&
    draft.verificationScope === stored.verificationScope &&
    draft.verificationUrl.trim() === (stored.verificationUrl ?? "").trim() &&
    draft.verificationLabel.trim() === (stored.verificationLabel ?? "").trim()
  );
}

function reviewPrepDraftMatchesTask(task: Task, draft: ReviewPrepDraft): boolean {
  const prep = getReviewPrep(task);
  return (
    draft.heading.trim() === prep.heading.trim() &&
    normalizeTrackedFieldValue(draft.summary) === normalizeTrackedFieldValue(prep.summary)
  );
}

function agentPlanDraftMatchesTask(task: Task, plan: string): boolean {
  return normalizeTrackedFieldValue(plan) === normalizeTrackedFieldValue(task.agentPlan);
}

function agentReviewViewDraftMatchesTask(task: Task, view: string): boolean {
  return normalizeTrackedFieldValue(view) === normalizeTrackedFieldValue(task.agentReviewView);
}

function getTaskWithPendingDrafts(task: Task): Task {
  let next = task;
  const deliveryDraft = pendingDeliveryDrafts.get(task.id);
  if (deliveryDraft) {
    const heading = deliveryDraft.heading.trim() || task.reviewDeliveryHeading?.trim() || task.title;
    next = {
      ...next,
      reviewDeliveryHeading: heading,
      reviewDeliverySummary: deliveryDraft.summary.trim(),
      reviewVerificationScope: deliveryDraft.verificationScope,
      reviewVerificationUrl: deliveryDraft.verificationUrl.trim() || undefined,
      reviewVerificationLabel: deliveryDraft.verificationLabel.trim() || undefined,
    };
  }
  const planDraft = pendingAgentPlanDrafts.get(task.id);
  if (planDraft != null) {
    next = { ...next, agentPlan: planDraft.trim() };
  }
  const prepDraft = pendingReviewPrepDrafts.get(task.id);
  if (prepDraft) {
    next = {
      ...next,
      reviewPrepHeading: prepDraft.heading.trim() || task.reviewPrepHeading?.trim() || task.title,
      reviewPrepSummary: prepDraft.summary.trim(),
    };
  }
  const agentViewDraft = pendingAgentReviewViewDrafts.get(task.id);
  if (agentViewDraft != null) {
    next = { ...next, agentReviewView: agentViewDraft.trim() };
  }
  return next;
}

function scheduleReviewDeliveryAutoSave(taskId: string, draft: ReviewDeliveryDraft): void {
  pendingDeliveryDrafts.set(taskId, draft);
  scheduleAutoSave("delivery", taskId, () => {
    const pending = pendingDeliveryDrafts.get(taskId);
    if (!pending || !autoSaveRunners) return;
    if (autoSaveRunners.commitDelivery(taskId, pending, { silent: true })) {
      pendingDeliveryDrafts.delete(taskId);
    }
  });
}

function flushReviewDeliveryAutoSave(taskId: string): void {
  const pending = pendingDeliveryDrafts.get(taskId);
  flushAutoSaveTimer("delivery", taskId);
  if (pending && autoSaveRunners) {
    autoSaveRunners.commitDelivery(taskId, pending, { silent: true });
    pendingDeliveryDrafts.delete(taskId);
  }
}

function scheduleReviewPrepAutoSave(taskId: string, draft: ReviewPrepDraft): void {
  pendingReviewPrepDrafts.set(taskId, draft);
  scheduleAutoSave("prep", taskId, () => {
    const pending = pendingReviewPrepDrafts.get(taskId);
    if (!pending || !autoSaveRunners) return;
    if (autoSaveRunners.commitPrep(taskId, pending, { silent: true })) {
      pendingReviewPrepDrafts.delete(taskId);
    }
  });
}

function flushReviewPrepAutoSave(taskId: string): void {
  const pending = pendingReviewPrepDrafts.get(taskId);
  flushAutoSaveTimer("prep", taskId);
  if (pending && autoSaveRunners) {
    autoSaveRunners.commitPrep(taskId, pending, { silent: true });
    pendingReviewPrepDrafts.delete(taskId);
  }
}

function scheduleAgentPlanAutoSave(taskId: string, plan: string): void {
  pendingAgentPlanDrafts.set(taskId, plan);
  scheduleAutoSave("plan", taskId, () => {
    const pending = pendingAgentPlanDrafts.get(taskId);
    if (pending == null || !autoSaveRunners) return;
    if (autoSaveRunners.commitPlan(taskId, pending, { silent: true })) {
      pendingAgentPlanDrafts.delete(taskId);
    }
  });
}

function flushAgentPlanAutoSave(taskId: string): void {
  const pending = pendingAgentPlanDrafts.get(taskId);
  flushAutoSaveTimer("plan", taskId);
  if (pending != null && autoSaveRunners) {
    autoSaveRunners.commitPlan(taskId, pending, { silent: true });
    pendingAgentPlanDrafts.delete(taskId);
  }
}

function applyPendingDraftsInline(task: Task, actor: ActivityActor = "user"): Task {
  let next = task;
  const deliveryDraft = pendingDeliveryDrafts.get(task.id);
  if (deliveryDraft && !deliveryDraftMatchesTask(next, deliveryDraft)) {
    const summary = deliveryDraft.summary.trim();
    const heading = deliveryDraft.heading.trim() || next.title;
    if (hasReviewDeliveryReady(next, summary)) {
      const scope = getReviewVerificationScope(next, deliveryDraft.verificationScope);
      const urlInput = deliveryDraft.verificationUrl.trim();
      if (!(scope === "stardesk" && urlInput && !normalizeVerificationUrl(urlInput))) {
        next = applyReviewDeliveryToTask(
          next,
          heading,
          summary,
          actor,
          deliveryDraft.verificationUrl,
          deliveryDraft.verificationLabel,
          deliveryDraft.verificationScope,
        );
      }
    }
  }
  const prepDraft = pendingReviewPrepDrafts.get(task.id);
  if (prepDraft && !reviewPrepDraftMatchesTask(next, prepDraft)) {
    const summary = prepDraft.summary.trim();
    if (summary.length >= REVIEW_DELIVERY_MIN_SUMMARY_LEN) {
      const skills = (next.reviewPrepSkills?.length
        ? next.reviewPrepSkills
        : suggestReviewSkills(next).map((s) => s.id)) as string[];
      const reviewer = next.reviewPrepReviewer ?? suggestReviewer(next).id;
      next = applyReviewPrepToTask(next, prepDraft.heading, summary, skills, reviewer, actor);
    }
  }
  const planDraft = pendingAgentPlanDrafts.get(task.id);
  if (planDraft != null && !agentPlanDraftMatchesTask(next, planDraft)) {
    const trimmed = planDraft.trim();
    if (hasAgentPlanReady(next, trimmed)) {
      next = applyAgentPlanToTask(next, trimmed, actor);
    }
  }
  const agentViewDraft = pendingAgentReviewViewDrafts.get(task.id);
  if (agentViewDraft != null && !agentReviewViewDraftMatchesTask(next, agentViewDraft)) {
    const trimmed = agentViewDraft.trim();
    if (trimmed) {
      next = applyAgentReviewViewToTask(next, trimmed, actor);
    }
  }
  return next;
}

function clearPendingDraftsForTask(taskId: string): void {
  flushAutoSaveTimer("delivery", taskId);
  flushAutoSaveTimer("prep", taskId);
  flushAutoSaveTimer("plan", taskId);
  flushAutoSaveTimer("agentReviewView", taskId);
  pendingDeliveryDrafts.delete(taskId);
  pendingReviewPrepDrafts.delete(taskId);
  pendingAgentPlanDrafts.delete(taskId);
  pendingAgentReviewViewDrafts.delete(taskId);
}

function scheduleAgentReviewViewAutoSave(taskId: string, view: string): void {
  pendingAgentReviewViewDrafts.set(taskId, view);
  scheduleAutoSave("agentReviewView", taskId, () => {
    const pending = pendingAgentReviewViewDrafts.get(taskId);
    if (pending == null || !autoSaveRunners) return;
    if (autoSaveRunners.commitAgentReviewView(taskId, pending, { silent: true })) {
      pendingAgentReviewViewDrafts.delete(taskId);
    }
  });
}

function flushAgentReviewViewAutoSave(taskId: string): void {
  const pending = pendingAgentReviewViewDrafts.get(taskId);
  flushAutoSaveTimer("agentReviewView", taskId);
  if (pending != null && autoSaveRunners) {
    autoSaveRunners.commitAgentReviewView(taskId, pending, { silent: true });
    pendingAgentReviewViewDrafts.delete(taskId);
  }
}

function flushAllTaskAutoSaves(taskId: string): void {
  flushReviewDeliveryAutoSave(taskId);
  flushReviewPrepAutoSave(taskId);
  flushAgentPlanAutoSave(taskId);
  flushAgentReviewViewAutoSave(taskId);
}

function formatAutoSaveHint(
  deliveryStatus: AutoSaveStatus,
  agentReviewViewStatus: AutoSaveStatus,
  showRequiredHint: boolean,
  deliveryReady: boolean,
): string | null {
  if (deliveryStatus === "pending" || agentReviewViewStatus === "pending") {
    return "Gemmer automatisk…";
  }
  if (deliveryStatus === "saved" || agentReviewViewStatus === "saved") return "Gemt";
  if (showRequiredHint && !deliveryReady) {
    return "Mangler udfyldning — kan ikke flyttes til Review endnu.";
  }
  return "Ændringer gemmes automatisk.";
}

function ReviewPrepPanel({
  task,
  theme,
  draft,
  onDraftChange,
  onStartAgent,
  onRequestReview,
  agentFeedback,
  prepReady,
  autoSaveStatus = "idle",
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
  draft: ReviewPrepDraft;
  onDraftChange: (next: ReviewPrepDraft) => void;
  onStartAgent: () => void;
  onRequestReview: () => void;
  agentFeedback: string | null;
  prepReady: boolean;
  autoSaveStatus?: AutoSaveStatus;
}) {
  const prep = getReviewPrep(task);
  const suggestedSkills = suggestReviewSkills(task);
  const suggestedReviewer = suggestReviewer(task);
  const when = formatReviewDeliveryWhen(prep.at);
  const skillLabels = (prep.skills.length ? prep.skills : suggestedSkills.map((s) => s.id))
    .map((id) => getSkillById(id)?.label ?? id)
    .join(" · ");

  return (
    <Stack
      gap={10}
      style={{
        border: `2px solid ${theme.stroke.primary}`,
        borderRadius: 8,
        padding: 16,
        background: theme.fill.secondary,
      }}
    >
      <Text weight="semibold" style={{ fontSize: 16 }}>
        Review-forberedelse (før Review)
      </Text>
      <Text size="small" tone="secondary">
        Review-agenten vælger skills og reviewer og skriver begrundelse her. Opgaven må først
        flyttes til Review når kasse er udfyldt (mindst et afsnit). Ændringer gemmes automatisk.
      </Text>
      <Stack gap={4}>
        <Text size="small" tone="tertiary">
          Foreslåede skills
        </Text>
        <Text size="small">{skillLabels || "—"}</Text>
      </Stack>
      <Stack gap={4}>
        <Text size="small" tone="tertiary">
          Reviewer
        </Text>
        <Text size="small">
          {prep.reviewerLabel ?? suggestedReviewer.label} (
          {prep.reviewer ?? suggestedReviewer.id})
        </Text>
        <Text size="small" tone="secondary">
          {getReviewerById(prep.reviewer ?? suggestedReviewer.id)?.focus ??
            suggestedReviewer.focus}
        </Text>
      </Stack>
      {agentFeedback ? (
        <Text size="small" weight="semibold">
          {agentFeedback}
        </Text>
      ) : null}
      <Row gap={6} wrap>
        <Button variant="secondary" onClick={onStartAgent}>
          Start review-agent
        </Button>
      </Row>
      <Text size="small" tone="secondary">
        Overskrift
      </Text>
      <TextInput
        value={draft.heading}
        onChange={(value) => onDraftChange({ ...draft, heading: value })}
        placeholder="Kort overskrift — hvorfor klar til review"
      />
      <Text size="small" tone="secondary">
        Begrundelse for Review (obligatorisk)
      </Text>
      <TextArea
        rows={8}
        value={draft.summary}
        onChange={(value) => onDraftChange({ ...draft, summary: value })}
        placeholder="Flydende dansk: leverance, acceptkriterier, test, reviewer-fokus…"
      />
      <CollapsibleVersionHistory
        entries={task.fieldHistory?.reviewPrepSummary ?? []}
        theme={theme}
      />
      {when ? (
        <Text size="small" tone="tertiary">
          Sidst opdateret {when}
        </Text>
      ) : null}
      <Row gap={6} wrap align="center">
        <Button variant="primary" onClick={onRequestReview} disabled={!prepReady}>
          Klar til agent review
        </Button>
        {autoSaveStatus === "pending" ? (
          <Text size="small" tone="tertiary" weight="semibold">
            Gemmer automatisk…
          </Text>
        ) : autoSaveStatus === "saved" ? (
          <Text size="small" tone="tertiary">
            Gemt
          </Text>
        ) : (
          <Text size="small" tone="tertiary">
            Ændringer gemmes automatisk
          </Text>
        )}
      </Row>
      {!prepReady ? (
        <Text size="small" tone="tertiary">
          Udfyld begrundelse (min. 40 tegn) eller start review-agenten først.
        </Text>
      ) : null}
      {prep.at ? (
        <Text size="small" tone="tertiary">
          Sidst gemt {formatActivityWhen(prep.at)} · {formatActivityActor(task.reviewPrepActor)}
        </Text>
      ) : null}
    </Stack>
  );
}

function ActivityLogEntryList({
  entries,
  theme,
}: {
  entries: TaskActivityEntry[];
  theme: ReturnType<typeof useHostTheme>;
}) {
  if (entries.length === 0) {
    return (
      <Text size="small" tone="tertiary">
        Ingen registrerede handlinger endnu.
      </Text>
    );
  }
  return (
    <Stack
      gap={6}
      style={{
        marginTop: 6,
        paddingLeft: 8,
        borderLeft: `2px solid ${theme.stroke.tertiary}`,
      }}
    >
      {entries.map((entry, index) => (
        <Stack
          key={`${entry.at}-${index}`}
          gap={2}
          style={{
            borderLeft: `3px solid ${
              entry.actor === "agent" ? theme.accent.primary : theme.stroke.primary
            }`,
            paddingLeft: 10,
            marginLeft: -8,
          }}
        >
          <Text size="small" weight="semibold">
            {formatActivityWhen(entry.at)} · {formatActivityActor(entry.actor)}
          </Text>
          <Text size="small">{entry.action}</Text>
          {entry.detail ? (
            <Text size="small" tone="secondary" style={{ whiteSpace: "pre-wrap" }}>
              {entry.detail}
            </Text>
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}

function TaskActivityLogPanel({
  task,
  theme,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
}) {
  const [expandedByTaskId, setExpandedByTaskId] = useCanvasState<Record<string, boolean>>(
    "stardesk-activity-log-expanded-v1",
    {},
  );
  const entries = [...(task.activityLog ?? [])].reverse();
  const expanded = expandedByTaskId[task.id] ?? false;

  const toggleExpanded = () => {
    setExpandedByTaskId((prev) => ({
      ...prev,
      [task.id]: !(prev[task.id] ?? false),
    }));
  };

  return (
    <Stack
      style={{
        borderTop: `1px solid ${theme.stroke.primary}`,
        paddingTop: 14,
      }}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          color: theme.text.primary,
          width: "100%",
          textAlign: "left",
        }}
      >
        <Text
          size="small"
          tone="tertiary"
          style={{
            display: "inline-block",
            transform: expanded ? "rotate(90deg)" : "none",
          }}
        >
          ›
        </Text>
        <Text weight="semibold" as="span">
          Aktivitetslog
          {entries.length > 0 ? (
            <Text as="span" size="small" tone="tertiary">
              {" "}
              ({entries.length})
            </Text>
          ) : null}
        </Text>
      </button>
      {expanded ? <ActivityLogEntryList entries={entries} theme={theme} /> : null}
    </Stack>
  );
}

const PLAYWRIGHT_EVIDENCE_STATUS_LABEL: Record<ReviewPlaywrightEvidence["status"], string> = {
  pending: "Afventer kørsel",
  running: "Kører…",
  passed: "Bestået",
  failed: "Fejlet",
  skipped: "Sprunget over",
};

function ReviewPlaywrightEvidencePanel({
  task,
  theme,
  onCopyPipelineCommand,
  pipelineCopyFeedback,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
  onCopyPipelineCommand?: () => void;
  pipelineCopyFeedback?: string | null;
}) {
  const [expandedByTaskId, setExpandedByTaskId] = useCanvasState<Record<string, boolean>>(
    "stardesk-playwright-evidence-expanded-v1",
    {},
  );
  const [lightboxUrl, setLightboxUrl] = useCanvasState<string | null>(
    "stardesk-playwright-evidence-lightbox-v1",
    null,
  );
  const evidence = task.reviewPlaywrightEvidence;
  const expanded = expandedByTaskId[task.id] ?? false;
  const screenshotCount = evidence?.screenshots.length ?? 0;
  const showPanel =
    isAnyReviewColumnStatus(task.status) ||
    task.status === "Done" ||
    (task.status === "Archived" && evidence != null);

  if (!showPanel) return null;

  const toggleExpanded = () => {
    setExpandedByTaskId((prev) => ({
      ...prev,
      [task.id]: !(prev[task.id] ?? false),
    }));
  };

  return (
    <Stack
      style={{
        borderTop: `1px solid ${theme.stroke.primary}`,
        paddingTop: 14,
      }}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          color: theme.text.primary,
          width: "100%",
          textAlign: "left",
        }}
      >
        <Text
          size="small"
          tone="tertiary"
          style={{
            display: "inline-block",
            transform: expanded ? "rotate(90deg)" : "none",
          }}
        >
          ›
        </Text>
        <Text weight="semibold" as="span">
          Playwright-evidence
          {screenshotCount > 0 ? (
            <Text as="span" size="small" tone="tertiary">
              {" "}
              ({screenshotCount} billeder)
            </Text>
          ) : null}
        </Text>
      </button>
      {expanded ? (
        <Stack gap={10} style={{ marginTop: 10 }}>
          {evidence?.status === "pending" ? (
            <Stack
              gap={8}
              style={{
                border: `1px solid ${theme.diff.renamed}`,
                borderRadius: 8,
                padding: 12,
                background: theme.fill.secondary,
              }}
            >
              <Text size="small" weight="semibold">
                Playwright afventer kørsel
              </Text>
              <Text size="small" tone="secondary">
                Canvas kan ikke køre Playwright. Brug GitHub Actions (anbefalet) eller kopiér
                pipeline-kommandoen nedenfor.
              </Text>
              <Row gap={6} wrap>
                <Button variant="secondary" type="button" onClick={onCopyPipelineCommand}>
                  Kør Playwright-agent (kopiér kommando)
                </Button>
              </Row>
              {pipelineCopyFeedback ? (
                <Text size="small" weight="semibold">
                  {pipelineCopyFeedback}
                </Text>
              ) : null}
            </Stack>
          ) : null}
          {!evidence ? (
            <Text size="small" tone="secondary">
              Ingen Playwright-kørsel endnu — startes automatisk ved skift til Review (scope
              stardesk).
            </Text>
          ) : (
            <>
              <Row gap={8} wrap align="center">
                <Text size="small" weight="semibold">
                  {PLAYWRIGHT_EVIDENCE_STATUS_LABEL[evidence.status]}
                </Text>
                {evidence.username ? (
                  <Text size="small" tone="tertiary">
                    Bruger: {evidence.username}
                  </Text>
                ) : null}
                {evidence.verificationUrl ? (
                  <a
                    href={evidence.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: theme.accent.primary }}
                  >
                    Åbn mål-URL
                  </a>
                ) : null}
              </Row>
              <Text
                size="small"
                tone="secondary"
                style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
              >
                {evidence.log}
              </Text>
              {evidence.screenshots.length > 0 ? (
                <Row gap={8} wrap>
                  {evidence.screenshots.map((shot) => (
                    <button
                      key={shot.id}
                      type="button"
                      onClick={() => setLightboxUrl(shot.dataUrl)}
                      style={{
                        border: `1px solid ${theme.stroke.primary}`,
                        borderRadius: 8,
                        padding: 6,
                        background: theme.bg.elevated,
                        cursor: "pointer",
                        maxWidth: 160,
                        textAlign: "left",
                      }}
                    >
                      <img
                        src={shot.dataUrl}
                        alt={shot.caption}
                        style={{
                          display: "block",
                          width: "100%",
                          maxHeight: 96,
                          objectFit: "contain",
                          borderRadius: 4,
                        }}
                      />
                      <Text
                        size="small"
                        tone="tertiary"
                        style={{
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shot.caption}
                      </Text>
                    </button>
                  ))}
                </Row>
              ) : evidence.status === "pending" ? (
                <Text size="small" tone="tertiary">
                  Afventer screenshots fra ekstern Playwright-runner.
                </Text>
              ) : null}
            </>
          )}
        </Stack>
      ) : null}
      {lightboxUrl ? (
        <div
          role="presentation"
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          <img
            src={lightboxUrl}
            alt="Playwright screenshot"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </Stack>
  );
}

type PipelineAgentKind = "kodeklar" | "refinement" | "ready";

function pipelineAgentKindForStatus(status: Status): PipelineAgentKind | null {
  if (isPipelineStartStatus(status)) return "kodeklar";
  if (status === "Refinement") return "refinement";
  if (status === "Ready") return "ready";
  return null;
}

function WorkflowPipelinePanel({
  task,
  theme,
  onStartPipelineAgent,
  pipelineFeedback,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
  onStartPipelineAgent?: (kind: PipelineAgentKind) => void;
  pipelineFeedback?: string | null;
}) {
  const kind = pipelineAgentKindForStatus(task.status);
  if (!kind && task.status !== "Bobler" && task.status !== "Backlog") return null;

  const specReady = hasKodeklarSpec(task);
  const planReady = hasAgentPlanReady(task);
  const readyGate = hasReadyToImplement(task);

  const titleByStatus: Record<string, string> = {
    Bobler: "Upstream workflow — Bobler",
    Backlog: "Upstream workflow — Backlog",
    Refinement: "Upstream workflow — Refinement",
    Ready: "Upstream workflow — Ready",
  };

  const borderColor = readyGate
    ? theme.diff.added
    : specReady || planReady
      ? theme.diff.renamed
      : theme.stroke.primary;

  return (
    <Stack
      gap={8}
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: 12,
        background: theme.fill.secondary,
      }}
    >
      <Text weight="semibold">{titleByStatus[task.status] ?? "Upstream workflow"}</Text>
      <Stack gap={4}>
        <Text size="small" tone="secondary">
          Kodningsklar spec: {specReady ? "✓ klar" : "mangler — start kodeklar-agent"}
        </Text>
        <Text size="small" tone="secondary">
          Agent-plan (min. {AGENT_PLAN_MIN_LEN} tegn): {planReady ? "✓ klar" : "mangler — refinement-agent"}
        </Text>
        <Text size="small" tone="secondary">
          Klar til I gang: {readyGate ? "✓ gates opfyldt" : "afventer spec + plan"}
        </Text>
      </Stack>
      {COLUMN_WORKFLOW_HINTS[task.status] ? (
        <Text size="small" tone="tertiary">
          {COLUMN_WORKFLOW_HINTS[task.status]}
        </Text>
      ) : null}
      {onStartPipelineAgent && kind ? (
        <Row gap={6} wrap>
          {isPipelineStartStatus(task.status) && !specReady ? (
            <Button variant="primary" type="button" onClick={() => onStartPipelineAgent("kodeklar")}>
              Start kodeklar-agent
            </Button>
          ) : null}
          {isPipelineStartStatus(task.status) && specReady ? (
            <Button variant="secondary" type="button" onClick={() => onStartPipelineAgent("kodeklar")}>
              Genstart kodeklar-agent
            </Button>
          ) : null}
          {task.status === "Refinement" ? (
            <Button variant="secondary" type="button" onClick={() => onStartPipelineAgent("refinement")}>
              Start plan-agent
            </Button>
          ) : null}
          {task.status === "Ready" ? (
            <Button variant="secondary" type="button" onClick={() => onStartPipelineAgent("ready")}>
              Start ready-agent
            </Button>
          ) : null}
        </Row>
      ) : null}
      {pipelineFeedback ? (
        <Text size="small" weight="semibold">
          {pipelineFeedback}
        </Text>
      ) : null}
    </Stack>
  );
}

function AcceptCriteriaMatrixPanel({
  task,
  theme,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
}) {
  const rows = mergeAcceptCriteriaForDisplay(task);
  if (rows.length === 0) return null;

  const passed = rows.filter((row) => row.status === "passed").length;
  const failed = rows.filter((row) => row.status === "failed").length;

  return (
    <Stack gap={6}>
      <Row gap={8} wrap align="center">
        <Text size="small" weight="semibold">
          Acceptkriterier
        </Text>
        <Text size="small" tone="secondary">
          {passed}/{rows.length} bestået
          {failed > 0 ? ` · ${failed} fejlet` : ""}
        </Text>
      </Row>
      {(["functional", "technical"] as const).map((category) => {
        const inCategory = rows.filter((row) => row.category === category);
        if (inCategory.length === 0) return null;
        return (
          <Stack key={category} gap={4}>
            <Text size="small" tone="tertiary">
              {ACCEPT_CRITERION_CATEGORY_LABEL[category]}
            </Text>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {inCategory.map((row) => (
                <li key={row.id} style={{ marginBottom: 4 }}>
                  <Text size="small" style={{ lineHeight: 1.45 }}>
                    {formatAcceptCriterionStatusIcon(row.status)}{" "}
                    {ACCEPT_CRITERION_STATUS_LABEL[row.status]} — {row.text}
                    {row.method ? (
                      <Text as="span" size="small" tone="tertiary">
                        {" "}
                        ({row.method})
                      </Text>
                    ) : null}
                    {row.note ? (
                      <Text as="span" size="small" tone="secondary">
                        {" "}
                        — {row.note}
                      </Text>
                    ) : null}
                  </Text>
                </li>
              ))}
            </ul>
          </Stack>
        );
      })}
    </Stack>
  );
}

function AgentReviewEvidencePanel({
  task,
  theme,
  verificationGate,
  onStartAgentReview,
  agentReviewFeedback,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
  verificationGate: AgentReviewVerificationGate;
  onStartAgentReview?: () => void;
  agentReviewFeedback?: string | null;
}) {
  const evidence = task.agentReviewEvidence;
  const showPanel =
    isAgentReviewStatus(task.status) ||
    isHumanReviewStatus(task.status) ||
    task.status === "Done" ||
    (task.status === "Archived" && evidence != null);

  if (!showPanel) return null;

  const status = evidence?.status ?? "pending";
  const borderColor =
    status === "failed"
      ? theme.diff.removed
      : status === "passed" || status === "skipped"
        ? theme.diff.added
        : verificationGate.warn
          ? theme.diff.renamed
          : theme.stroke.primary;

  return (
    <Stack
      gap={10}
      style={{
        borderTop: `1px solid ${theme.stroke.primary}`,
        paddingTop: 14,
      }}
    >
      <Stack
        gap={8}
        style={{
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          padding: 12,
          background: theme.fill.secondary,
        }}
      >
        <Row gap={8} wrap align="center">
          <Text size="small" weight="semibold">
            Agent Review-verifikation
          </Text>
          <Text size="small" tone="secondary">
            {AGENT_REVIEW_EVIDENCE_STATUS_LABEL[status]}
          </Text>
          {evidence?.method ? (
            <Text size="small" tone="tertiary">
              · {AGENT_REVIEW_METHOD_LABEL[evidence.method]}
            </Text>
          ) : null}
        </Row>
        {evidence?.summary ? (
          <Text size="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {evidence.summary}
          </Text>
        ) : (
          <Text size="small" tone="secondary">
            Cursor-agent verificerer leverance automatisk ved skift til Agent Review. Læs skill{" "}
            <Text as="span" size="small" weight="semibold">
              stardesk-agent-review
            </Text>
            .
          </Text>
        )}
        {evidence?.humanReviewHandoff && isHumanReviewStatus(task.status) ? (
          <Stack gap={4}>
            <Text size="small" weight="semibold">
              Handoff til Human Review
            </Text>
            <Text size="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {evidence.humanReviewHandoff}
            </Text>
          </Stack>
        ) : null}
        {evidence?.status === "passed" && isAgentReviewStatus(task.status) ? (
          <Text size="small" weight="semibold" tone="secondary">
            Verifikation bestået — sagen flyttes automatisk til Human Review.
          </Text>
        ) : null}
        {evidence?.findings && evidence.findings.length > 0 ? (
          <Stack gap={4}>
            <Text size="small" weight="semibold">
              Fund ({evidence.findings.length})
            </Text>
            <Text size="small" tone="secondary" style={{ whiteSpace: "pre-wrap" }}>
              {evidence.findings.map((line) => `• ${line}`).join("\n")}
            </Text>
          </Stack>
        ) : null}
        {mergeAcceptCriteriaForDisplay(task).length > 0 ? (
          <AcceptCriteriaMatrixPanel task={task} theme={theme} />
        ) : null}
        {verificationGate.message ? (
          <Text
            size="small"
            weight={verificationGate.blocked ? "semibold" : undefined}
            tone={verificationGate.blocked ? "secondary" : "tertiary"}
          >
            {verificationGate.message}
          </Text>
        ) : null}
        {isAgentReviewStatus(task.status) && onStartAgentReview ? (
          <Row gap={6} wrap>
            <Button variant="secondary" type="button" onClick={onStartAgentReview}>
              Start Agent Review-agent
            </Button>
          </Row>
        ) : null}
        {agentReviewFeedback ? (
          <Text size="small" weight="semibold">
            {agentReviewFeedback}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}

function parseReviewRejectionReason(description: string): string | null {
  const match = description.match(
    /--- Review afvist ---\s*\nBegrundelse:\s*([\s\S]*?)(?:\n\n---|\n\nAgent:|\s*$)/,
  );
  return match?.[1]?.trim() || null;
}

function taskNeedsAgentRerun(task: Task): boolean {
  if (task.agentRerunRequired) return true;
  return (
    task.status === "In Progress" &&
    (task.description.includes(REVIEW_REJECTED_MARKER) ||
      task.description.includes(AGENT_RERUN_MARKER))
  );
}

function getInProgressAgentHint(task: Task): string | null {
  if (task.number === 74 || task.id === "t-74") {
    return "Agent: implementerer Playwright auto-trigger";
  }
  if (taskNeedsAgentRerun(task)) {
    const reason = getAgentRerunReason(task);
    return reason ? reason.slice(0, 160) : "Agent genkører efter Review-afvisning";
  }
  return null;
}

function buildPlaywrightPipelineCommand(task: Task): string {
  const taskNo = formatTaskNumber(task);
  return [
    `# Playwright pipeline for Work Board #${taskNo}`,
    `cd STARDESK/scripts`,
    `npm run review:playwright:pipeline -- --task ${taskNo}`,
    ``,
    `# Eller GitHub Actions (anbefalet — ingen lokal kørsel):`,
    `Actions → Review Playwright Evidence → Run workflow → task_number=${taskNo}`,
    `# Kræver secrets: TEST_USER_PASSWORD, STARDESK_API_URL, STARDESK_API_TOKEN`,
  ].join("\n");
}

/** Hårdt krav: genkørt / afvist sag i I gang må kun afsluttes i Agent Review. */
function validateWorkboardStatusChange(
  task: Task,
  targetStatus: string,
): { allowed: true } | { allowed: false; message: string } {
  const upstreamStatuses: Status[] = ["Bobler", "Backlog", "Refinement", "Ready"];

  if (
    targetStatus === "In Progress" &&
    (task.status === "Bobler" || task.status === "Backlog" || task.status === "Refinement")
  ) {
    return {
      allowed: false,
      message: SKIP_PIPELINE_TO_IN_PROGRESS_MESSAGE,
    };
  }
  if (task.status === "Ready" && targetStatus === "In Progress") {
    if (!hasReadyToImplement(task)) {
      return {
        allowed: false,
        message: READY_TO_IN_PROGRESS_MESSAGE,
      };
    }
  }
  if (task.status === "Refinement" && targetStatus === "Ready") {
    if (!hasAgentPlanReady(task)) {
      return {
        allowed: false,
        message: REFINEMENT_TO_READY_MESSAGE,
      };
    }
  }
  if (
    (task.status === "Bobler" || task.status === "Backlog") &&
    targetStatus === "Refinement"
  ) {
    if (!hasKodeklarSpec(task)) {
      return {
        allowed: false,
        message: KODEKLAR_SPEC_REQUIRED_MESSAGE,
      };
    }
  }
  if (
    (task.status === "Bobler" || task.status === "Backlog") &&
    targetStatus === "Ready"
  ) {
    return {
      allowed: false,
      message: SKIP_REFINEMENT_MESSAGE,
    };
  }
  if (
    upstreamStatuses.includes(task.status) &&
    (targetStatus === "Review" || targetStatus === "Human Review")
  ) {
    return {
      allowed: false,
      message: UPSTREAM_TO_REVIEW_MESSAGE,
    };
  }
  if (task.status === "In Progress" && targetStatus === "Done") {
    return {
      allowed: false,
      message: "Hårdt krav (alle sager): flyt til Agent Review først — ikke direkte til Done.",
    };
  }
  if (
    task.status === "In Progress" &&
    taskNeedsAgentRerun(task) &&
    targetStatus !== "Review"
  ) {
    return {
      allowed: false,
      message: "Hårdt krav: genkørt sag skal tilbage til Agent Review.",
    };
  }
  if (taskNeedsAgentRerun(task) && targetStatus === "Done") {
    return {
      allowed: false,
      message: "Hårdt krav: genkørt sag skal til Agent Review — ikke Done.",
    };
  }
  if (task.status === "In Progress" && targetStatus === "Human Review") {
    return {
      allowed: false,
      message:
        "Flyt først til Agent Review — agent udfylder leverance og sender derefter til Human Review.",
    };
  }
  if (task.status === "Review" && targetStatus === "Done") {
    return {
      allowed: false,
      message: "Godkendelse sker i Human Review — send først til Human Review.",
    };
  }
  if (task.status === "Review" && targetStatus === "Human Review") {
    const gate = getAgentReviewVerificationGate(task);
    if (gate.blocked) {
      return {
        allowed: false,
        message: gate.message ?? "Agent Review ikke bestået — kan ikke sende til Human Review.",
      };
    }
  }
  if (
    (targetStatus === "Review" || targetStatus === "Human Review") &&
    !hasReviewDeliveryReady(task)
  ) {
    return {
      allowed: false,
      message: reviewDeliveryBlockMessage(task),
    };
  }
  if (
    (targetStatus === "Review" || targetStatus === "Human Review") &&
    !hasAgentPlanReady(task)
  ) {
    return {
      allowed: false,
      message: AGENT_PLAN_REQUIRED_MESSAGE,
    };
  }
  return { allowed: true };
}

function clearAgentRerunFlags<T extends Task>(task: T): T {
  return {
    ...task,
    agentRerunRequired: false,
    agentRerunReason: undefined,
    agentRerunAt: undefined,
  };
}

function getAgentRerunReason(task: Task): string {
  if (task.agentRerunReason?.trim()) return task.agentRerunReason.trim();
  return parseReviewRejectionReason(task.description) ?? "";
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Invalid data URL"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function normalizeReviewRejectAttachment(
  entry: ReviewRejectAttachment | ReviewRejectImage,
): ReviewRejectAttachment {
  if ("kind" in entry && entry.kind) return entry;
  return { ...entry, kind: "image" };
}

function getTaskReviewRejectAttachments(task: Task): ReviewRejectAttachment[] {
  if (task.reviewRejectAttachments && task.reviewRejectAttachments.length > 0) {
    return task.reviewRejectAttachments.map(normalizeReviewRejectAttachment);
  }
  return (task.reviewRejectImages ?? []).map(normalizeReviewRejectAttachment);
}

function countReviewRejectAttachments(attachments: ReviewRejectAttachment[]): {
  images: number;
  videos: number;
  total: number;
} {
  let images = 0;
  let videos = 0;
  for (const entry of attachments) {
    if (entry.kind === "video") videos += 1;
    else images += 1;
  }
  return { images, videos, total: attachments.length };
}

function isReviewRejectVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

function isReviewRejectImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function formatReviewRejectAttachmentSummary(imageCount: number, videoCount: number): string {
  const parts: string[] = [];
  if (imageCount > 0) parts.push(`${imageCount} skærmbillede(r)`);
  if (videoCount > 0) parts.push(`${videoCount} video(er)`);
  return parts.join(", ");
}

function formatAgentRerunReasonText(
  text: string,
  imageCount: number,
  videoCount: number,
): string {
  const trimmed = text.trim();
  const parts: string[] = [];
  if (trimmed) parts.push(trimmed);
  const attachmentSummary = formatReviewRejectAttachmentSummary(imageCount, videoCount);
  if (attachmentSummary) {
    parts.push(
      `${attachmentSummary} vedhæftet — se reviewRejectAttachments på opgaven i canvas.data.json.`,
    );
  }
  return parts.join("\n\n");
}

function buildReviewRejectionAppend(
  reason: string,
  imageCount = 0,
  videoCount = 0,
): string {
  const trimmed = reason.trim();
  const hasAttachments = imageCount > 0 || videoCount > 0;
  const reasonLine =
    trimmed || (hasAttachments ? "(ingen tekst — kun vedhæftninger)" : "(ingen tekst)");
  const attachmentLine = hasAttachments
    ? `\nVedhæftninger: ${formatReviewRejectAttachmentSummary(imageCount, videoCount)} (felt reviewRejectAttachments på opgaven).`
    : "";
  return `

${REVIEW_REJECTED_MARKER}
Begrundelse: ${reasonLine}${attachmentLine}

${AGENT_RERUN_MARKER}
Status: In Progress (genstart)
ALTID OVERHOLDES: Cursor-agenten skal udføre opgaven FORFRA i STARdesk-kodebasen og adressere ALLE punkter i begrundelsen — uden undtagelse.
Se også **agentPlan** i sag-detalje — følg/opdater planen ved genkørsel.
HÅRDT KRAV (alle sager): Når genkørslen er færdig → agent flytter opgaven til **Agent Review** (\`"status": "Review"\`) i Work Board, derefter **Human Review** efter self-review (aldrig Done; brugeren trykker ikke knap).`;
}

function buildAgentRerunPrompt(task: Task, rejectionReason: string): string {
  const reason = rejectionReason.trim() || getAgentRerunReason(task);
  const specIdx = task.description.indexOf(SPEC_MARKER);
  const spec =
    specIdx >= 0 ? task.description.slice(specIdx) : task.description.slice(0, 4000);

  return `# Work Board #${task.number} — GENKØRSEL (Review afvist)

## Opgave
${task.title}

## Opgave-id
${task.id}

## Prioritet
${task.priority}

## Begrundelse fra review (SKAL adresseres)
${reason}
${(() => {
  const attachments = getTaskReviewRejectAttachments(task);
  const { images, videos } = countReviewRejectAttachments(attachments);
  if (attachments.length === 0) return "";
  const summary = formatReviewRejectAttachmentSummary(images, videos);
  return `\n## Vedhæftninger fra review (${attachments.length})\nReviewer vedhæftede ${summary} — se \`reviewRejectAttachments\` på opgaven i \`${WORKBOARD_DATA_JSON}\` (base64 data URLs). Afspil videoer i sag-detalje eller åbn data URL i browser.\n`;
})()}
${task.agentPlan?.trim() ? `## Eksisterende agent-plan (følg/opdater)\n${task.agentPlan.trim()}\n` : ""}
## ALTID OVERHOLDES (genkørsel)
1. Udfør opgaven **forfra** — ret/implementér i STARdesk repo (apps/web, apps/api, osv.).
2. Tag udgangspunkt i **alle** kommentarer i begrundelsen; ignorer ingen punkter.
3. **Brugeren trykker IKKE «Tilbage til Review»** — det er **agentens** ansvar at afslutte korrekt.
4. Opret ikke ny Work Board-opgave; dette er genkørsel af #${task.number}.

## Afslutning (agent — obligatorisk, sidste steps)
Opdater \`${WORKBOARD_DATA_JSON}\`:
- Find opgaven med \`"number": ${task.number}\` eller \`"id": "${task.id}"\` i \`stardesk-tasks-v1\`.

**Step A — Review-forberedelse (kasse nederst i åben sag):**
- \`"reviewPrepHeading"\`, \`"reviewPrepSummary"\` (flydende dansk, min. 4–8 sætninger).
- \`"reviewPrepSkills"\`: relevante skill-id fra katalog (fx ${JSON.stringify(suggestReviewSkills(task).map((s) => s.id))}).
- \`"reviewPrepReviewer"\`: \`"${suggestReviewer(task).id}"\` eller bedre match.
- \`"reviewPrepAt"\`: tidsstempel.

**Step A2 — Agent-plan (mellem beskrivelse og Review i sag-detalje):**
- \`"agentPlan"\`: konkrete implementeringstrin agent tog/planlægger (min. 80 tegn, dansk).
- \`"agentPlanAt"\`: tidsstempel; \`"agentPlanActor"\`: \`"agent"\`.

**Step B — Flyt til Agent Review:**
- Sæt \`"status": "Review"\` (kolonne-label: Agent Review).
- Fjern \`agentRerunRequired\`, \`agentRerunReason\`, \`agentRerunAt\`.
- \`"reviewDeliveryHeading"\` / \`"reviewDeliverySummary"\` (kan spejle reviewPrep; brugeren læser i Human Review).
- \`"reviewVerificationScope"\`: \`"stardesk"\` (deployet app — kræver URL) eller \`"cursor"\` (kun Work Board/canvas — ingen STARDESK-link).
- \`"reviewVerificationUrl"\`: kun ved scope \`"stardesk"\` — fuld deployed STARDESK-URL (fx \`${STARDESK_WEB_BASE_URL}/aktiver\`).
- \`"reviewVerificationLabel"\`: valgfri dansk linktekst ved scope \`"stardesk"\` (fx «Åbn Aktiver-siden»).
- \`"reviewDeliveryAt"\`: tidsstempel.
- \`"reviewDeliveryActor"\`: \`"agent"\`.
- Tilføj til \`activityLog\` (behold eksisterende, append):
  \`{ "at": <ms>, "actor": "agent", "action": "Implementering færdig → Agent Review", "detail": "<kort overskrift>" }\`

**Step C — Agent Review → Human Review (efter agent self-review):**
- Opdater \`agentReviewEvidence.status\`: \`passed\` | \`failed\`
- Ved **passed**: Work Board flytter **automatisk** til Human Review (log: «Agent review bestået → Human Review»)
- Ved **failed**: flyt til **In Progress** med findings — ikke Human Review
- **Aldrig** Done; Jan godkender i Human Review

## Eksisterende spec og kontekst
${spec}
`;
}

function buildInProgressWorkPrompt(task: Task): string {
  const specIdx = task.description.indexOf(SPEC_MARKER);
  const spec =
    specIdx >= 0 ? task.description.slice(specIdx) : task.description.slice(0, 4000);

  return `# Work Board #${task.number} — I GANG

## Opgave
${task.title}

## Opgave-id
${task.id}

## Prioritet
${task.priority}

## ALTID OVERHOLDES
1. Implementér opgaven i STARdesk repo (apps/web, apps/api, osv.) efter spec nedenfor.
2. Work Board-opgaven findes allerede — dette er opgave #${task.number}; opret ikke ny.
3. **Brugeren trykker IKKE «Klar til review»** — det er **agentens** ansvar at afslutte korrekt.

## Afslutning (agent — obligatorisk, sidste steps)
Opdater \`${WORKBOARD_DATA_JSON}\`:
- Find opgaven med \`"number": ${task.number}\` eller \`"id": "${task.id}"\` i \`stardesk-tasks-v1\`.

**Step A — Review-forberedelse (kasse nederst i åben sag):**
- \`"reviewPrepHeading"\`, \`"reviewPrepSummary"\` (flydende dansk, min. 4–8 sætninger).
- \`"reviewPrepSkills"\`: relevante skill-id fra katalog (fx ${JSON.stringify(suggestReviewSkills(task).map((s) => s.id))}).
- \`"reviewPrepReviewer"\`: \`"${suggestReviewer(task).id}"\` eller bedre match.
- \`"reviewPrepAt"\`: tidsstempel.

**Step A2 — Agent-plan (mellem beskrivelse og Review i sag-detalje):**
- \`"agentPlan"\`: konkrete implementeringstrin agent tog/planlægger (min. 80 tegn, dansk).
- \`"agentPlanAt"\`: tidsstempel; \`"agentPlanActor"\`: \`"agent"\`.

**Step B — Flyt til Agent Review:**
- Sæt \`"status": "Review"\` (kolonne-label: Agent Review).
- \`"reviewDeliveryHeading"\` / \`"reviewDeliverySummary"\` (kan spejle reviewPrep; Jan læser i Human Review).
- \`"reviewVerificationScope"\`: \`"stardesk"\` (deployet app — kræver URL) eller \`"cursor"\` (kun Work Board/canvas — ingen STARDESK-link).
- \`"reviewVerificationUrl"\`: kun ved scope \`"stardesk"\` — fuld deployed STARDESK-URL (fx \`${STARDESK_WEB_BASE_URL}/aktiver\`).
- \`"reviewVerificationLabel"\`: valgfri dansk linktekst ved scope \`"stardesk"\` (fx «Åbn Aktiver-siden»).
- \`"reviewDeliveryAt"\`: tidsstempel.
- \`"reviewDeliveryActor"\`: \`"agent"\`.
- Tilføj til \`activityLog\`: \`{ "at": <ms>, "actor": "agent", "action": "Implementering færdig → Agent Review", "detail": "<kort overskrift>" }\`

**Step C — Agent Review → Human Review (efter agent self-review):**
- Opdater \`agentReviewEvidence.status\`: \`passed\` | \`failed\`
- Ved **passed**: Work Board flytter **automatisk** til Human Review (log: «Agent review bestået → Human Review»)
- Ved **failed**: flyt til **In Progress** med findings — ikke Human Review
- **Aldrig** Done; Jan godkender i Human Review

## Spec og kontekst
${spec}
`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type SortMode = "manual" | "number" | "date" | "priority" | "title";
type NewTaskDraft = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  owner: string;
  tags: string;
  parentId?: string;
};

type ResizingState = {
  column: Status;
  startX: number;
  startWidth: number;
} | null;

const COLUMN_WIDTH_SNAPS = [88, 108, 140, 200, 260, 300, 340, 380, 420, 480, 560, 640];
const COMPACT_MAX_WIDTH = 140;
/** Below this width the column header stacks title above sort controls. */
const COLUMN_HEADER_STACK_WIDTH = 320;

/** Statuses where work can be requested to start implementation. */
const REQUEST_IN_PROGRESS_FROM: Status[] = ["Ready"];

function snapWidth(nextWidth: number): number {
  let best = COLUMN_WIDTH_SNAPS[0] ?? 300;
  let bestDist = Math.abs(best - nextWidth);
  for (const candidate of COLUMN_WIDTH_SNAPS) {
    const dist = Math.abs(candidate - nextWidth);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

function parseNumberFromId(id: string): number | null {
  const match = id.match(/^t-(\d+)$/);
  return match?.[1] ? Number(match[1]) : null;
}

function taskSortNumber(task: Task): number {
  return task.number;
}

function formatTaskNumber(task: Task): string {
  return String(task.number);
}

function getChildTasks(all: Task[], parentId: string): Task[] {
  return all
    .filter((task) => task.parentId === parentId)
    .sort((a, b) => a.number - b.number);
}

function nextTaskNumber(all: Task[]): number {
  const max = all.reduce((acc, task) => Math.max(acc, task.number), 0);
  return max + 1;
}

function ensureTaskNumbers(tasks: Task[]): Task[] {
  let auto = nextTaskNumber(tasks.filter((t) => typeof t.number === "number"));
  return tasks.map((task) => {
    if (typeof task.number === "number") return task;
    const fromId = parseNumberFromId(task.id);
    if (fromId != null) return { ...task, number: fromId };
    const next = auto;
    auto += 1;
    return { ...task, number: next };
  });
}

function taskDateValue(task: Task): number {
  if (typeof task.createdAt === "number") return task.createdAt;
  const tsMatch = task.id.match(/^t-(\d{12,})$/);
  return tsMatch?.[1] ? Number(tsMatch[1]) : 0;
}

function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  if (mode === "manual") {
    return [...tasks].sort((a, b) => {
      const ai = a.boardIndex ?? Number.MAX_SAFE_INTEGER;
      const bi = b.boardIndex ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return taskSortNumber(a) - taskSortNumber(b);
    });
  }
  const next = [...tasks];
  next.sort((a, b) => {
    if (mode === "number") return taskSortNumber(a) - taskSortNumber(b);
    if (mode === "date") return taskDateValue(b) - taskDateValue(a);
    if (mode === "priority") {
      const rank: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return rank[a.priority] - rank[b.priority];
    }
    return a.title.localeCompare(b.title, "da");
  });
  return next;
}

const COLUMNS: Status[] = [
  "Bobler",
  "Backlog",
  "Refinement",
  "Ready",
  "In Progress",
  "Review",
  "Human Review",
  "Done",
  "Archived",
];

const COLUMN_LABELS: Record<Status, string> = {
  Bobler: "Bobler",
  Backlog: "Backlog",
  Refinement: "Refinement",
  Ready: "Ready",
  "In Progress": "In Progress",
  Review: "Agent Review",
  "Human Review": "Human Review",
  Done: "Done",
  Archived: "Lukkede opgaver",
};

const COLUMN_SHORT_LABELS: Record<Status, string> = {
  Bobler: "Bobler",
  Backlog: "Backlog",
  Refinement: "Refine",
  Ready: "Ready",
  "In Progress": "I gang",
  Review: "Agent",
  "Human Review": "Human",
  Done: "Done",
  Archived: "Lukket",
};

/** All kanban columns for task detail / new-task status pickers (same order as board). */
function statusPickerOptions(
  customLabels?: ColumnLabelOverrides,
): { value: string; label: string }[] {
  return COLUMNS.map((col) => ({
    value: col,
    label: customLabels?.[col]?.trim() || COLUMN_LABELS[col],
  }));
}

/** Default ThemedPicker maxHeight (280) clips after ~6 options — hides Human Review, Done, Archived. */
const STATUS_PICKER_PANEL_MAX_HEIGHT = 420;

type ColumnLabelOverrides = Partial<Record<Status, string>>;

/** Index to insert at the top of a column (first card in that status). */
function insertIndexAtTopOfColumn(remaining: Task[], targetStatus: Status): number {
  const firstInColumn = remaining.findIndex((task) => task.status === targetStatus);
  if (firstInColumn >= 0) return firstInColumn;

  const targetColIndex = COLUMNS.indexOf(targetStatus);
  for (let colIdx = targetColIndex + 1; colIdx < COLUMNS.length; colIdx += 1) {
    const col = COLUMNS[colIdx];
    if (!col) continue;
    const firstInLaterCol = remaining.findIndex((task) => task.status === col);
    if (firstInLaterCol >= 0) return firstInLaterCol;
  }
  return remaining.length;
}

function insertTaskAtColumnTop(
  remaining: Task[],
  movedTask: Task,
  targetStatus: Status,
): Task[] {
  const insertIndex = insertIndexAtTopOfColumn(remaining, targetStatus);
  return assignBoardIndices([
    ...remaining.slice(0, insertIndex),
    { ...movedTask, status: targetStatus },
    ...remaining.slice(insertIndex),
  ]);
}

/** Persist kanban order per status — stored in task.boardIndex (Neon extra JSON). */
function assignBoardIndices(tasks: Task[]): Task[] {
  const orderInFullList = new Map(tasks.map((task, index) => [task.id, index]));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  let index = 0;
  for (const status of COLUMNS) {
    const inColumn = tasks
      .filter((task) => task.status === status)
      .sort((a, b) => {
        const ai = a.boardIndex ?? orderInFullList.get(a.id) ?? 0;
        const bi = b.boardIndex ?? orderInFullList.get(b.id) ?? 0;
        if (ai !== bi) return ai - bi;
        return taskSortNumber(a) - taskSortNumber(b);
      });
    for (const task of inColumn) {
      const next = byId.get(task.id);
      if (!next) continue;
      byId.set(task.id, { ...next, boardIndex: index });
      index += 1000;
    }
  }
  return tasks.map((task) => byId.get(task.id) ?? task);
}

function tasksForDbPersist(tasks: Task[]): Task[] {
  return assignBoardIndices([...tasks]);
}

/** Passed agent review + gates — status-agnostic (Human Review already promoted counts too). */
function taskQualifiesForHumanReviewPromote(task: Task): boolean {
  if (!AGENT_REVIEW_AUTO_HUMAN_ON_PASSED) return false;
  if (task.agentReviewEvidence?.status !== "passed") return false;
  const gate = getAgentReviewVerificationGate(task);
  return !gate.blocked;
}

function canAutoPromoteToHumanReview(task: Task): boolean {
  if (task.status !== "Review") return false;
  return taskQualifiesForHumanReviewPromote(task);
}

/** Auto-move Agent Review → Human Review when verification passed (semi-auto handoff). */
function promotePassedAgentReviewTasks(current: Task[]): Task[] {
  const promoteIds = new Set(
    current.filter(canAutoPromoteToHumanReview).map((task) => task.id),
  );
  if (promoteIds.size === 0) return current;

  let result = current.filter((task) => !promoteIds.has(task.id));
  for (const task of current) {
    if (!promoteIds.has(task.id)) continue;
    let merged = applyStatusToTask(task, "Human Review");
    merged = appendWorkflowTransitionActivity(merged, "Review", "Human Review", "agent");
    result = insertTaskAtColumnTop(result, merged, "Human Review");
  }
  return result;
}

const DONE_TO_ARCHIVE_MS = 60 * 60 * 1000;
const AUTO_ARCHIVE_CHECK_MS = 60 * 1000;

function inferDoneAtFromTask(task: Task): number {
  const log = task.activityLog ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (!entry) continue;
    const action = entry.action.toLowerCase();
    if (
      action.includes("done") ||
      action.includes("godkendt") ||
      action.includes("flyttet til done")
    ) {
      return entry.at;
    }
  }
  // Never use reviewDeliveryAt — it predates godkendelse and caused instant auto-archive.
  return Date.now();
}

function backfillDoneAtIfNeeded(task: Task): Task {
  if (task.status !== "Done") {
    if (task.doneAt != null) return { ...task, doneAt: undefined };
    return task;
  }
  if (task.doneAt != null) return task;
  return { ...task, doneAt: inferDoneAtFromTask(task) };
}

function applyStatusToTask(task: Task, targetStatus: Status): Task {
  let base: Task = { ...task, status: targetStatus };
  if (targetStatus === "Review" && taskNeedsAgentRerun(task)) {
    base = clearAgentRerunFlags(base);
  }
  if (targetStatus === "Done") {
    base = { ...base, doneAt: Date.now() };
  } else if (task.status === "Done" && targetStatus !== "Done") {
    base = { ...base, doneAt: undefined };
  }
  return base;
}

function runAutoArchivePass(current: Task[]): { next: Task[]; archivedCount: number } {
  const now = Date.now();
  const withBackfill = current.map(backfillDoneAtIfNeeded);
  const toArchive = withBackfill.filter(
    (task) =>
      task.status === "Done" &&
      task.doneAt != null &&
      now - task.doneAt >= DONE_TO_ARCHIVE_MS,
  );

  if (toArchive.length === 0) {
    const changed = withBackfill.some(
      (task, index) =>
        task.doneAt !== current[index]?.doneAt || task.status !== current[index]?.status,
    );
    return { next: changed ? withBackfill : current, archivedCount: 0 };
  }

  let result = withBackfill;
  for (const task of toArchive) {
    const remaining = result.filter((entry) => entry.id !== task.id);
    const archived = appendTaskActivity(
      applyStatusToTask(task, "Archived"),
      "agent",
      "Automatisk flyttet til Lukkede opgaver",
      "1 time i Done efter godkendelse",
    );
    result = insertTaskAtColumnTop(remaining, archived, "Archived");
  }
  return { next: result, archivedCount: toArchive.length };
}

const WORKBOARD_DB_AUTOSAVE_MS = 5 * 60 * 1000;
const WORKBOARD_DB_DEBOUNCE_MS = 2500;
const WORKBOARD_DEFAULT_API_URL = "https://api-gamma-amber.vercel.app";

type DbSyncState = "idle" | "saving" | "ok" | "error";

type DbSyncStatus = {
  state: DbSyncState;
  at?: number;
  message?: string;
  created?: number;
  updated?: number;
};

type LocalSaveStatus = {
  at?: number;
};

type BulkImportResult = {
  created?: number;
  updated?: number;
  skipped?: number;
  soft_deleted?: number;
};

async function bulkImportWorkboardTasks(
  tasks: Task[],
  apiUrl: string,
  token: string,
): Promise<BulkImportResult> {
  const fetchFn = globalThis.fetch;
  if (!fetchFn) {
    throw new Error("Network utilgængelig i canvas — kør migrate-workboard-json-to-db.mjs.");
  }
  const base = apiUrl.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetchFn(`${base}/api/v1/workboard/tasks/bulk-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tasks, replace_missing: false }),
    });
  } catch (err) {
    throw new Error(describeDbSyncFetchError(err));
  }
  const text = await res.text();
  if (!res.ok) {
    const hint = formatDbSyncHttpHint(res.status, text);
    throw new Error(`Import fejlede (${res.status}): ${text.slice(0, 240)}${hint}`);
  }
  try {
    return JSON.parse(text) as BulkImportResult;
  } catch {
    return {};
  }
}

function describeDbSyncFetchError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (
    err instanceof TypeError &&
    /fetch|network|Failed to fetch|Load failed/i.test(raw)
  ) {
    return (
      "Netværksfejl (ofte CORS): canvas-origin blokeres af API. " +
      "Opdater API CORS (null / vscode-webview) eller brug scripts/migrate-workboard-json-to-db.mjs."
    );
  }
  return raw || "Ukendt fejl ved gem";
}

function formatDbSyncHttpHint(status: number, body: string): string {
  if (status === 401) {
    return " — JWT ugyldigt eller udløbet; log ind igen via /api/v1/auth/login.";
  }
  if (status === 403) return " — mangler staff-rettigheder.";
  if (status === 404) return " — endpoint findes ikke (tjek API URL).";
  if (status === 503) return " — database ikke konfigureret på API.";
  if (status === 500) {
    const lower = body.toLowerCase();
    if (
      lower.includes("workboard_tasks") ||
      lower.includes("does not exist") ||
      lower.includes("undefinedtable")
    ) {
      return " — kør alembic upgrade head på Neon (workboard_tasks mangler).";
    }
    return " — serverfejl; tjek API-logs / migration.";
  }
  return "";
}

function formatDaTimeShort(at: number): string {
  return new Date(at).toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDaDateTime(at: number): string {
  return new Date(at).toLocaleString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DbSyncToolbarDisplay = {
  statusText: string;
  timestamp: string;
  tone: "secondary" | "primary";
  errorDetail?: string;
};

function getDbSyncToolbarDisplay(status: DbSyncStatus): DbSyncToolbarDisplay {
  if (status.state === "saving") {
    return { statusText: "Synkroniserer…", timestamp: "", tone: "secondary" };
  }
  if (status.state === "idle") {
    return { statusText: "Afventer", timestamp: "", tone: "secondary" };
  }
  if (status.state === "ok" && status.at) {
    return {
      statusText: "Opdateret",
      timestamp: formatDaDateTime(status.at),
      tone: "secondary",
    };
  }
  if (status.state === "error") {
    return {
      statusText: "Fejl",
      timestamp: status.at ? formatDaDateTime(status.at) : "",
      tone: "primary",
      errorDetail: status.message?.trim(),
    };
  }
  return { statusText: "Afventer", timestamp: "", tone: "secondary" };
}

function formatDbSyncLabel(status: DbSyncStatus): string {
  if (status.state === "saving") return "Gemmer til Neon…";
  if (!status.at) return "";
  const time = formatDaTimeShort(status.at);
  if (status.state === "error") {
    const base = `Neon-fejl kl. ${time}`;
    const detail = status.message?.trim();
    if (!detail) return base;
    const short = detail.length > 72 ? `${detail.slice(0, 72)}…` : detail;
    return `${base} — ${short}`;
  }
  if (status.state === "ok") return `Neon gemt kl. ${time}`;
  return "";
}

function formatLocalSaveLabel(status: LocalSaveStatus): string {
  if (!status.at) return "";
  return `Gemt lokalt kl. ${formatDaTimeShort(status.at)}`;
}

let dbAutosaveIntervalStarted = false;
let dbAutosaveEnabledSnapshot = false;
let dbSyncApiTokenSnapshot = "";
let dbSaveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let dbSyncInFlight = false;
let dbSaveTrigger: ((trigger: "manual" | "auto") => Promise<void>) | null = null;
/** Latest tasks from canvas render — avoids stale closure in auto-save. */
let workboardTasksSnapshot: Task[] = [];
/** Ref mirror of drag id — state + dataTransfer alone can miss drops in webviews. */
let draggingTaskIdRef: string | null = null;

function resolveDroppedTaskId(
  draggingStateId: string | null,
  dataTransfer: DataTransfer | null,
): string | null {
  const fromRef = draggingTaskIdRef?.trim() || null;
  if (fromRef) return fromRef;
  if (draggingStateId?.trim()) return draggingStateId.trim();
  try {
    const fromData = dataTransfer?.getData("application/x-stardesk-task")?.trim();
    return fromData || null;
  } catch {
    return null;
  }
}

function clearDraggingTaskId(): void {
  draggingTaskIdRef = null;
}

type SetWorkboardTasksFn = (action: Task[] | ((prev: Task[]) => Task[])) => void;

function scheduleDebouncedWorkboardDbSave(): void {
  if (!dbAutosaveEnabledSnapshot || !dbSyncApiTokenSnapshot.trim()) return;
  if (dbSaveDebounceTimer) globalThis.clearTimeout?.(dbSaveDebounceTimer);
  dbSaveDebounceTimer = globalThis.setTimeout?.(() => {
    dbSaveDebounceTimer = null;
    void dbSaveTrigger?.("auto");
  }, WORKBOARD_DB_DEBOUNCE_MS) ?? null;
}

/** Sync workboardTasksSnapshot on every tasks write (DB auto-save reads snapshot). */
function createWorkboardTasksSetter(setTasksRaw: SetWorkboardTasksFn): SetWorkboardTasksFn {
  return (action) => {
    if (typeof action === "function") {
      setTasksRaw((prev) => {
        const raw = action(prev);
        const next = guardHumanReviewDowngrades(raw, prev);
        workboardTasksSnapshot = next;
        scheduleDebouncedWorkboardDbSave();
        return next;
      });
    } else {
      const next = guardHumanReviewDowngrades(action, workboardTasksSnapshot);
      workboardTasksSnapshot = next;
      setTasksRaw(next);
      scheduleDebouncedWorkboardDbSave();
    }
  };
}

function scheduleWorkboardDbAutosave(): void {
  if (dbAutosaveIntervalStarted) return;
  dbAutosaveIntervalStarted = true;
  globalThis.setInterval?.(() => {
    if (!dbAutosaveEnabledSnapshot) return;
    void dbSaveTrigger?.("auto");
  }, WORKBOARD_DB_AUTOSAVE_MS);
}

let autoArchiveIntervalStarted = false;

function scheduleAutoArchiveChecks(
  setTasks: (action: Task[] | ((prev: Task[]) => Task[])) => void,
  onBatchArchived: (count: number) => void,
): void {
  if (autoArchiveIntervalStarted) return;
  autoArchiveIntervalStarted = true;

  const tick = () => {
    setTasks((prev) => {
      const { next, archivedCount, needsPersist } = reconcileHydratedTasks(prev);
      if (archivedCount > 0) {
        globalThis.setTimeout?.(() => onBatchArchived(archivedCount), 0);
        return next;
      }
      if (needsPersist) return next;
      return prev;
    });
  };

  globalThis.setTimeout?.(() => tick(), 0);
  globalThis.setInterval?.(tick, AUTO_ARCHIVE_CHECK_MS);
}

type ToastUndo =
  | { kind: "restoreDeleted"; task: Task }
  | { kind: "restoreStatus"; taskId: string; status: Status }
  | { kind: "removeCreated"; taskId: string };

type ToastState = {
  message: string;
  undo: ToastUndo | null;
};

/** Specs from STARDESK/Background/KANBAN-WORKBOARD.md § Kodningsklare forslag */
const CODING_SPECS: Record<string, string> = {
  "t-1": `Mål: Opret en asset-katalogmodel med ITIL-lignende standardfelter.
Scope: apps/api model + migration + CRUD API + apps/web liste-/detaljevisning.
Output: Asset-tabeller, validering, API endpoints, UI til oprettelse/redigering.
Acceptkriterier: Kan oprette/redigere/søge assets; relation til sager virker; tests grønne.`,

  "t-2": `Mål: Grundintegration til Slack (fase 1 — se også Slack sagssync).
Scope: OAuth/app install, kanal-konfiguration, health-check endpoint.
Output: Verificeret forbindelse + kan poste testbesked fra STARdesk.
Acceptkriterier: Integration kan aktiveres/deaktiveres; secrets i env; fejl logges uden tokens.`,

  "t-6": `Mål: Synkroniser sager til Slack-kanal og tillad opdatering via Slack.
Scope: webhook router, signaturvalidering, mapping mellem Slack thread og ticket.
Output: Push af nye opdateringer + inbound kommando/hook til ticket-kommentar.
Acceptkriterier: Slack-besked opretter/opdaterer korrekt sag; audit-log gemmes.`,

  "t-5": `Mål: Integrer Keycloak login og flow for indmelding -> approval -> auto-opret.
Scope: OIDC config, callback routes, role mapping, AI-opret service.
Output: Stabil login/session + workflow der kan auto-oprette sag.
Acceptkriterier: Bruger kan logge ind via Keycloak; approval-state kan toggles; AI-opret virker på testdata.`,

  "t-7": `Mål: Vis kort preview ved hover på sag-lister.
Scope: UI komponent + lazy data fetch + accessibility fallback.
Output: Tooltip/popover med titel, status, prioritet, seneste kommentar.
Acceptkriterier: Ingen layout-jump; keyboard focus virker; performance påvirkes minimalt.`,

  "t-8": `Mål: Muliggør @mentions fra STARdesk til Slack.
Scope: bruger-mapping (app user -> Slack user), mention parser, outbound formatter.
Output: Kommentar med mention sender korrekt Slack-notifikation.
Acceptkriterier: @navn bliver til korrekt Slack mention; fejl håndteres pænt.`,

  "t-9": `Mål: Tydelig visuel markering af major incidents.
Scope: badge/stripe i lister + detalje + filtre.
Output: "Stor sag" vises konsekvent i alle relevante views.
Acceptkriterier: Kan filtrere på stor sag; markering ses i både light/dark theme.`,

  "t-13": `Mål: Push/pull mellem STARdesk og Jira.
Scope: integration service, webhook endpoint, idempotent sync job.
Output: Opret/opdatér issue begge veje med feltmapping.
Acceptkriterier: Duplicate-beskyttelse virker; retry/backoff implementeret.`,

  "t-14": `Mål: Strammere validering og maskering af CPR-relaterede felter.
Scope: API schema-validering, frontend input masks, logging policy.
Output: Sanitized inputs + ingen CPR i usikre logs.
Acceptkriterier: Valideringsfejl er tydelige; sikkerhedstests passerer.`,

  "t-11": `Mål: Hurtig restore-procedure med konfigurerbare snapshots.
Scope: scripts + docs + verify-checklist.
Output: restore runbook og automatiseret smoke-check efter restore.
Acceptkriterier: Restore kan gennemføres i testmiljø end-to-end.`,

  "t-21": `Mål: Observability + regression-sikkerhed.
Scope: Sentry miljø-tags, release tracking, Playwright E2E kritiske flows.
Output: Alarmer, dashboards, CI E2E suite.
Acceptkriterier: Kritiske flows kører i CI; fejl kan spores til release.`,

  "t-22": `Mål: Automatiseret kodekvalitetskørsel med notifikation.
Scope: n8n workflow, secret management, summary message.
Output: Planlagt job + rapport i valgt kanal.
Acceptkriterier: Job kører stabilt; fejlnotifikation virker; secret ikke eksponeret.`,

  "t-44": `Mål: Automatiseret quality loop hver 2. dag med Sonar + destructive review og Cursor agent-flow.
Scope:
- scripts/n8n-workflows/run-quality-loop.mjs + stardesk-quality-loop.json
- Skills: stardesk-destructive-test-review, stardesk-sonar-review-loop
- npm run quality:loop
Output: Planlagt n8n-job + reports/quality-loop-agent-prompt.md efter hver kørsel.
Acceptkriterier:
- Manuel quality:loop skriver rapporter
- n8n workflow importeres; secrets på host
- Agent følger prompt + begge skills efter kørsel.`,

  "t-24": `Mål: Separat preprod før prod.
Scope: separat deploy target, env vars, DB, smoke test flow.
Output: preprod URL + deploy pipeline + verificeringscheckliste.
Acceptkriterier: ændringer kan valideres i preprod inden prod deploy.`,

  "t-25": `Mål: Route tickets sikkert til Jira Service Desk baseret på GDPR-indhold.
Flow:
- Ticket uden GDPR-match -> send fuld payload til Jira.
- Ticket med GDPR-match -> send sanitiseret payload (GDPR-felter fjernet/masket).
- Gem klassifikation (gdpr_detected=true/false) og hvad der blev maskeret.
Scope (API):
- Regex-klassifikator for GDPR (CPR, e-mail, telefon, adresser, fritekst-mønstre).
- Sanitiseringsfunktion der masker/fjerner følsomme felter før outbound sync.
- Jira client med API key auth via env secret.
- Kommando/endpoint til "opret i Jira" manuelt (POST /api/v1/integrations/jira/create).
- Webhooks frem/tilbage: STARdesk -> Jira (outbound) og Jira -> STARdesk (inbound updates).
Scope (drift/sikkerhed):
- API-nøgle i secret store/env, aldrig i logs.
- Idempotency key for webhook retries.
- Audit-log af sync events + fejl.
Output:
- Ny integrationsservice + router endpoints + webhook handlers + tests.
- Konfig-dokumentation med eksempelkommandoer.
Acceptkriterier:
- Tickets uden GDPR lander korrekt i Jira med alle relevante felter.
- Tickets med GDPR lander i Jira uden følsomme data.
- Roundtrip update via hooks virker begge veje uden duplikater.
- Fejl/retry/timeout håndteres robust.`,

  "t-10": `Mål: Lever en fuld brugeradministrationsside til staff/admin.
Scope: apps/web side + API integration for liste, søgning, rolle-/statusopdatering.
Output: Side med filter, sortering, redigering af rolle/aktiv-status og sikker adgangskontrol.
Acceptkriterier: Kun autoriserede roller kan tilgå siden; ændringer gemmes korrekt; audit-log registreres.`,

  "t-18": `Mål: Sikr korrekt flytning og vedvarende lagring af sag på modtagergruppe.
Scope: assignment API + UI flows i relevante sag-/board-visninger + regression tests.
Output: Stabil "flyt til gruppe" handling med bekræftelse og korrekt persistence.
Acceptkriterier: Flytning overlever refresh/reload; historik opdateres; ingen dubletplacering i lister.`,

  "t-19": `Mål: Formalisér forretningsregler og verificér dem systematisk mod golden store.
Scope: regeldefinitioner, valideringsservice, nightly/CI verifikationsjob, rapport-output.
Output: Regelkatalog, automatiske checks, fejlrapport med afvigelser.
Acceptkriterier: Hver regel har test; afvigelser vises med tydelig root-cause; CI markerer brud.`,

  "t-4": `Mål: Omsæt den åbne sikkerhedsopgave til konkret threat-model + hardening backlog.
Scope: auth, inputvalidering, secrets, logging, dependency-risk, abuse-scenarier.
Output: Prioriteret sikkerhedsrapport med fixes opdelt i P0/P1/P2.
Acceptkriterier: Min. top-10 risici dokumenteret med mitigation; P0 fixes oprettet som tasks.`,

  "t-3": `Mål: Gør testmiljø operationelt med fast patch-vurdering.
Scope: environment health checks, patch-cadence, restore-øvelser, release gate.
Output: Runbook, automatisk statuscheck, patch dashboard/rapport.
Acceptkriterier: Team kan se patch-status dagligt; restore-test gennemføres efter plan; release gate håndhæves.`,

  "t-26": `Mål: Få stabil generering af coverage i CI for både web og api.
Scope: apps/web (JS/TS) + apps/api (Python) coverage tooling, rapport-output, CI step-order (coverage før SonarScanner), lokal runbook.
Output:
- Coverage-rapporter fra begge apps i faste paths/formater.
- CI-validations der fejler ved manglende rapportfiler.
- Dokumenteret lokal kommando + CI-kommando for coverage.
Acceptkriterier:
- Pipeline genererer coverage for web + api på hver relevant PR.
- CI stopper tydeligt hvis coverage-artefakter mangler.
- Min. 1 kritisk flow i web og 1 kritisk flow i api har nye tests i samme leverance.
- Runbook beskriver hvor rapporter ligger og hvordan de verificeres.`,

  "t-33": `Mål: Knap-flow I gang → Review på Work Board.
Flow:
- Backlog/Refinement/Ready: knap "I gang" → In Progress.
- In Progress: knap "Klar til review" → Review.
Acceptkriterier: Korrekt kolonne; toast med fortryd; passer sammen med #32 godkend/afvis.`,

  "t-32": `Mål: Godkend/afvis-flow i Review-kolonnen på Work Board.
Flow:
- Godkend → Done.
- Afvis → obligatorisk begrundelse → In Progress + log i beskrivelse (agent genstarter).
Scope: Knapper på Review-kort; inline afvis-formular; toast med fortryd.
Acceptkriterier: Afvis kræver tekst; korrekt kolonneflyt; begrundelse i sagdetalje.`,

  "t-30": `Mål: Pæn synligheds-legend i venstre nav når kolonnen er smal.
Scope: Container query; kompakt tekst under smal bredde; fuld tekst ellers.
Acceptkriterier: Ingen ødelagt tekst-wrap ved smal nav; læsbar på dansk.`,

  "t-31": `Mål: Resizable kolonner på Aktiver-siden.
Scope: Ændringslog | aktivtræ | verdenskort+detail med react-resizable-panels og localStorage.
Acceptkriterier: Træk mellem kolonner; layout huskes; min-bredder respekteres.`,

  "t-29": `Mål: Automatisk flytning af sager i kanban/status-flow via agent.
Flow:
- Når sagen er færdig udfyldt (obligatoriske felter + routing-klarhed) → flyt til Review.
- Når sagen er lukket (bruger lukker / status closed) → flyt til Done.
Scope:
- Regelservice for "færdig udfyldt"; hooks ved PATCH/luk på ticket og kanban-kort.
- Opdater kanban-kolonne og/eller ticket status; audit-log; idempotens.
- Admin toggle enable/disable pr. board eller globalt.
Output:
- SagFlowAgent service + tests + korte regler i docs.
Acceptkriterier:
- Udfyldt sag → Review automatisk; lukket sag → Done.
- Ingen dobbelt-flytning; genåbnet sag trigges ikke tilbage uden ny hændelse.
- Integrationstest for begge overgange.`,

  "t-28": `Mål: Global admin layout-redigering på alle staff-sider med undo/rollback.
Scope:
- PageLayoutEditProvider + flydende "Rediger layout" knap (kun admin/top_admin).
- PageLayoutField/PageLayoutGrid med localStorage pr. normaliseret route.
- Undo: Fortryd-knap, Ctrl+Z, kommando "undo" i banner; historik (50 trin).
- Pilot: Ny sag (/tickets/new) + sagsdetalje-sidebar; udvid til øvrige sider.
- Fase 2 (valgfri): API page-layouts for delt konfiguration på tværs af browsere.
Output:
- Admin kan flytte felter, omdøbe labels, skifte bred/smal, skjule/vis, fortryde og nulstille.
Acceptkriterier:
- Kun admins ser knappen; normal brug uændret når redigering er fra.
- Layout gemmes og genindlæses; undo ruller ændringer tilbage.
- Min. Ny sag + sagsdetalje bruger PageLayoutField; dokumenteret tilføjelsesmønster.`,

  "t-27": `Mål: Få coverage synlig i SonarCloud og reducér høj-prioritets Sonar-fund.
Scope: SonarScanner parametre for coverage import, quality gate-oprydning, første batch af P0/P1 findings.
Output:
- SonarCloud import af coverage fra web + api.
- Baseline-måling og batch-plan for security/reliability først.
- Første gennemført fix-batch uden testregression.
Acceptkriterier:
- Sonar-projekt viser coverage-data for både web og api efter merge til main.
- CI fejler hvis Sonar import fejler.
- P0/P1 Sonar findings reduceres målbart i batch #1.
- Ingen nye kritiske regressions i tests efter fix-batch.`,

  "t-46": `Mål: Kolonne-titler på Work Board skal være synlige ved alle kolonnebredder.
Scope: stardesk-workboard.canvas.tsx — kolonne-header layout.
Output: Titel altid på egen linje når kolonne er smal/medium; sorteringskontrol som ikon (⇅) så den ikke skubber titlen væk.
Acceptkriterier:
- Smal kolonne (≤140px): kun titel + antal (uændret).
- Medium kolonne (141–320px): titel øverst, antal + sorterings-ikon nederst — titel altid læsbar.
- Bred kolonne (>320px): titel og sortering på én linje med ellipsis på lang titel.
- Tooltip med fuld kolonnenavn ved hover.`,

  "t-48": `Mål: Verifikationslink i Review så reviewer kan åbne STARDESK før godkendelse.
Scope:
- reviewVerificationUrl + reviewVerificationLabel på Task
- ReviewDeliveryViewPanel (kompakt på Review-kort) + link over Godkend
- URL-input i Leverance til review; toast-advarsel ved Godkend uden link (blokér ikke)
- Hård regel i stardesk-workboard.mdc
Acceptkriterier:
- Klikbart link åbner deployed STARDESK i ny fane
- Agent udfylder URL ved flyt til Review
- Eksisterende Review-opgaver backfilles med rimelige ruter`,

  "t-50": `Mål: Brugeren kan omdøbe kolonne-titler på Work Board via dobbeltklik.
Scope: stardesk-workboard.canvas.tsx — ColumnHeader, canvas state stardesk-column-labels-v1.
Output:
- Dobbeltklik på kolonne-titel → inline redigering (TextInput)
- Gem ved Enter/blur; Escape annullerer; toast «Kolonnenavn gemt»
- Tomt navn nulstiller til standard
- Kompakt kolonne: enkeltklik udvider stadig; dobbeltklik omdøber
Acceptkriterier:
- Alle kolonner (Bobler … Archived) kan omdøbes
- Custom navn persisteres i canvas data
- Standard-labels bruges når intet override er sat`,

  "t-51": `Mål: Én «Leverance til review»-sektion i sag-detalje — ingen duplikat read-only blok over redigeringsformularen.
Scope: stardesk-workboard.canvas.tsx — ReviewDeliveryViewPanel, ReviewDeliveryFieldsPanel, sag-detalje layout.
Output:
- Fjern read-only ReviewDeliveryViewPanel fra sag-detalje når edit-form vises
- Behold kompakt read-only leverance på Review-kort
- ReviewDeliveryFieldsPanel: Card/CardHeader, Divider, verifikationslink-forhåndsvisning i formularen
Acceptkriterier:
- Sag-detalje viser kun én «Leverance til review»-sektion (edit-form)
- Verifikationslink-preview i formularen når URL er udfyldt
- Review-kort: kompakt leverance + verifikationslink over Godkend
- Godkend-flow uændret (ReviewVerificationLinkBlock over Godkend-knapper)`,

  "t-52": `Mål: Hovedsag-vælger og «Opret underopgave» som små inline-knapper i sag-detalje.
Scope: stardesk-workboard.canvas.tsx — ThemedPicker compact, sag-detalje Row-layout.
Output:
- ThemedPicker compact prop (ghost, lille padding)
- Row med hovedsag-vælger + «Opret underopgave» side om side
- Backfill af reviewDelivery/reviewVerification/fieldHistory på alle eksisterende opgaver
Acceptkriterier:
- Ingen fuld-bredde knapper for hovedsag/underopgave
- Alle opgaver i canvas.data.json har påkrævede felter
- Opgave #52 i Review med leverance-felter`,

  "t-55": `Mål: Ét samlet Review-panel i sag-detalje — leverance + godkend/afvis i samme kort.
Scope: stardesk-workboard.canvas.tsx — ReviewPanel, sag-detalje, Review-kort.
Output:
- ReviewPanel: leverancefelter, verifikation og Godkend/Afvis i ét Card
- Fjern separat Review-blok og duplikat verifikationsheader
- Review-kort: kompakt leverance + Åbn sag (ingen fuld form på kort)
Acceptkriterier:
- Sag-detalje: én Review-sektion med alle actions
- Godkend/Afvis nederst i samme kort som leverance
- Afvis-begrundelse udvider i samme kort
- Review-kort duplikerer ikke fuld form eller godkend-knapper`,
  "t-56": `Mål: Stram validering og audit af alle Work Board-opgavers leverance-felter.
Scope:
- stardesk-workboard.mdc: Planlagt leverance kun i Backlog/Refinement/Ready/Bobler
- stardesk-workboard.canvas.tsx: hasReviewDeliveryReady (min. 80 tegn, afvis Planlagt/generisk)
- ReviewPanel: dansk hjælpetekst om konkret leverance
- stardesk-workboard.canvas.data.json: audit alle opgaver
Acceptkriterier:
- Review-transition blokeres ved generisk leverance med dansk toast
- Alle Review/I gang/Done/Archived har konkret reviewDeliverySummary
- Backlog/Ready beholder «Planlagt leverance:»`,

  "t-57": `Mål: Review Verifikation viser gyldig fuld URL til deployed STARDESK.
Scope: stardesk-workboard.canvas.tsx, canvas.data.json.
Output:
- normalizeVerificationUrl: strip junk, valider parsebar URL på STARDESK-origin
- inferReviewVerificationUrl: auto-foreslå rute fra tags/titel/spec
- ReviewPanel: hjælpetekst, quick-pick knapper, preview kun ved gyldig URL
- Backfill alle stardesk-scoped opgaver
Acceptkriterier:
- Placeholder viser kun fuld URL-eksempel
- Gem leverance afviser ugyldig URL med toast
- Auto-fill ved gem/flyt til Review når scope=stardesk og URL tom
- Preview- og Godkend-link åbner korrekt side i ny fane`,

  "t-59": `Mål: Vis Cursor agents plan mellem opgavebeskrivelse og Review i sag-detalje.
Scope: stardesk-workboard.canvas.tsx, canvas.data.json, stardesk-workboard.mdc.
Output:
- Task-felter: agentPlan, agentPlanAt, agentPlanActor, fieldHistory.agentPlan
- Tre vertikalt resizable paneler: Opgavebeskrivelse | Plan (Cursor) | Review
- Drag-handles mellem paneler (ns-resize, min 80px, max 600px)
- Review: plan read-only; I gang: redigerbar med Gem plan
- Afvis-flow: vis agentPlan over begrundelse; genkør-prompt refererer plan
- Backfill Review/I gang uden agentPlan fra spec/leverance
Acceptkriterier:
- Reviewer ser spec → plan → leverance/godkend
- agentPlan påkrævet (min. 80 tegn) ved flyt til Review
- Højder persisteres i stardesk-detail-panel-heights-v1
- Opgave #59 i Review med udfyldt agentPlan`,

  "t-70": `Mål: Aktivitetslog i sag-detalje skal være foldet ind som standard og kan ekspanderes.
Scope: stardesk-workboard.canvas.tsx — TaskActivityLogPanel, CollapsibleSection/disclosure-mønster.
Output:
- Klikbar titel «Aktivitetslog (N)» med chevron; standard collapsed ved åbning af sag
- Udvidet: kronologisk liste (nyeste først) med dato, aktør (Dig/Agent), action, detail
- Udvid-tilstand per opgave i stardesk-activity-log-expanded-v1 (Record<taskId, boolean>)
- Body-styling matcher Versionshistorik (borderLeft, padding)
Acceptkriterier:
- Lang aktivitetslog fylder ikke sag-detalje som standard
- Klik på titel toggler fold; tilstand huskes pr. opgave i canvas data
- Opgave #70 i Review med cursor-verifikation`,

  "t-73": `Mål: Review-afvisningsfelt skal understøtte indsættelse af skærmbilleder via Ctrl+V.
Scope: stardesk-workboard.canvas.tsx — ReviewPanel afvis-formular, rejectReviewTask, Task-type.
Output:
- onPasteCapture på wrapper omkring TextArea (SDK TextArea har ikke onPaste)
- Billeder gemmes i reviewRejectImages[] på opgaven (base64 data URL i canvas.data.json)
- Thumbnail-preview med fjern-knap; hjælpetekst «Du kan indsætte skærmbilleder med Ctrl+V»
- Maks. 3 billeder, 500 KB pr. billede; toast ved overskridelse
- Afvis → I gang: tekst + billeder i activityLog/description; thumbnails i genkørsel-panel
Acceptkriterier:
- Ctrl+V indsætter screenshot i afvis-feltet uden at erstatte tekst
- Afvis virker med kun tekst, kun billeder eller begge
- Agent genkørsel viser vedhæftede skærmbilleder i sag-detalje
- Opgave #73 i Review med cursor-verifikation`,

  "t-78": `Mål: Review-afvisning skal understøtte upload af video (og billede) med preview og persistens til agent-genkørsel.
Scope: stardesk-workboard.canvas.tsx — ReviewRejectReasonField, rejectReviewTask, Task.reviewRejectAttachments.
Output:
- Knap «Upload fil» ved afvis-formular (skjult file input: image/* + video mp4/webm/mov)
- Vedhæftninger i reviewRejectAttachments[] med kind image|video (base64 data URL)
- Ctrl+V beholdes for skærmbilleder; video-preview med <video controls>
- Maks. 3 billeder à 500 KB, 2 videoer à 20 MB; dansk toast ved overskridelse
- Afvis → I gang: vedhæftninger i description, agentRerunReason og activityLog; genkør-prompt nævner video
Acceptkriterier:
- Upload video viser preview før Afvis
- Afvis virker med tekst, kun vedhæftninger eller begge
- Agent genkørsel viser billeder og videoer i sag-detalje
- Opgave #78 i Review med reviewVerificationScope cursor`,

  "t-74": `Mål: Efter skift I gang→Review kører en Playwright-agent mod deployed STARDESK og gemmer screenshots + log i reviewPlaywrightEvidence.
Scope:
- stardesk-workboard.canvas.tsx: Task.reviewPlaywrightEvidence, foldbart panel under Review
- Ved Review-transition: status pending + reviewVerificationUrl (scope stardesk)
- STARDESK/scripts/run-review-playwright.mjs + import-playwright-evidence-to-workboard.mjs
- STARDESK/docs/review-playwright-agent.md; stardesk-workboard.mdc (valgfri evidence)
Flow:
1. Opgave flyttes til Review med reviewVerificationScope stardesk + URL
2. Canvas sætter reviewPlaywrightEvidence.status=pending (ingen Playwright i canvas)
3. Cursor-agent eller CI kører run-review-playwright.mjs (login sf01@example.dk via env)
4. import-script skriver base64 screenshots til canvas.data.json
Output:
- Foldbar «Playwright-evidence (N billeder)» i sag-detalje
- reports/review-evidence/{taskId}/ + manifest.json
Acceptkriterier:
- pending ved Review-transition; passed/failed efter import
- Screenshots klikbare; log viser trin
- TEST_USER_EMAIL/PASSWORD i env — ingen secrets i repo
- Opgave #74 forbliver Backlog indtil fuld auto-trigger (hook/CI)`,

  "t-61": `Mål: Brugeren kan scrolle/pan horisontalt på Work Board og se alle kolonner.
Scope: stardesk-workboard.canvas.tsx — board scroll container og navigation.
Output:
- Synlig horizontal scrollbar (styling til dark theme)
- Draggable bund-track (thumb) + Rul til venstre/højre
- Kolonne-hop chips (Gå til kolonne)
- Valgfri drag-to-pan på tom board-flade
- Scroll-position i stardesk-board-scroll-left-v1
Acceptkriterier:
- Alle kolonner (Bobler … Archived) kan nås uden layout-klip
- Kort-drag, kolonne-resize og sag-detalje virker uændret
- Scroll-position genoprettes efter reload`,

  "t-62": `Mål: Sag-detalje paneler auto-expanderer så spec, plan og leverance er synlige uden intern scroll.
Scope: stardesk-workboard.canvas.tsx — ResizableDetailSection, panel-højder, TextArea rows.
Output:
- Default auto-expand (min-height, height auto) for Opgavebeskrivelse, Plan, Review
- stardesk-detail-panel-heights-v1: null eller "auto" = auto; manuel resize gemmer px
- Dobbeltklik på drag-handle nulstiller til auto
- TextArea rows efter indhold (plan 4–20, leverance max(6, linjer))
- Sticky sektionsheaders; kun >40 linjer capper ved 70vh med scroll
Acceptkriterier:
- Fuld kodningsklar spec og agentPlan synlige ved åbning uden lille scrollboks
- Manuel resize virker; ny sag åbner i auto
- Horisontal board-scroll (#61) uændret`,

  "t-66": `Mål: Genskab drag-and-drop af opgaver mellem kolonner på Work Board.
Scope: stardesk-workboard.canvas.tsx — board pan (#61) vs HTML5 task drag.
Output:
- Pan starter ikke på kort, draggable-greb eller under aktiv task-drag
- data-board-card på native div; stopPropagation på kort-mousedown
- isBoardPanTarget: [draggable]; handleBoardPanStart: draggingId guard
Acceptkriterier:
- Træk kort (⋮⋮) fra Backlog til Review (eller anden kolonne) virker
- Horisontal pan på tom kolonne-flade virker stadig
- Kolonne-resize og scroll-track uændret`,

  "t-75": `Mål: Brugeren kan zoome Work Board-kanban ind/ud med Ctrl+scroll for at se flere kolonner.
Scope: stardesk-workboard.canvas.tsx — board scroll viewport (#61) og zoom state.
Output:
- Ctrl+scroll (⌘+scroll på Mac) zoomer board-indhold; preventDefault blokerer browser-zoom
- Zoom-range 50%–150%; default 100%
- CSS zoom på kanban-indhold (layout + scroll opdateres)
- Persistens i stardesk-board-zoom-v1
- Minimal zoom-indikator + nulstil-knap ved scroll-track
Acceptkriterier:
- Zoom ud viser flere kolonner; zoom ind forstørrelse
- Horisontal pan, scroll-track og kort-drag (#66) virker uændret
- Zoom-niveau genoprettes efter reload`,

  "t-76": `Mål: Manuel og automatisk persist af Work Board-opgaver til Neon via API.
Scope: stardesk-workboard.canvas.tsx — toolbar Gem-knap + 5-min auto-save.
Output:
- Gem-knap til højre for Reset kolonnebredder
- bulk-import til /api/v1/workboard/tasks/bulk-import (samme payload som migrate-script)
- Auto-save hvert 5. minut; debounce ved igangværende gem
- Status/Gemt kl. … ved knappen; toast Gemmer… / Gemt til database / fejl på dansk
- API URL + staff JWT i stardesk-db-sync-api-* (canvas state)
Acceptkriterier:
- Status/kolonne bevares ved gem (ingen seed-reset)
- Manuel gem virker med token; auto-save kører uden brugerhandling
- Fejl vises tydeligt hvis token eller netværk mangler`,

  "t-77": `Mål: Versionshistorik og aktivitetslog ved hver gem af tracked felter.
Scope: stardesk-workboard.canvas.tsx — appendFieldHistoryIfChanged, Gem plan/beskrivelse/leverance/review prep save handlers.
Output:
- appendFieldHistoryIfChanged: trim-sammenligning; ingen last-value dedup der springer gem over
- Gem plan/beskrivelse/leverance/review prep: patchTaskFields uden hydrate-on-write
- backfillAgentPlanIfNeeded: spring over hvis fieldHistory.agentPlan allerede findes
- Aktivitetslog: Beskrivelse gemt, Agent-plan gemt, Leverance til review, Review-forberedelse gemt
Acceptkriterier:
- To Gem plan-klik med forskellig tekst giver 2+ fieldHistory.agentPlan entries
- Beskrivelse gemt via Gem beskrivelse versionerer + activityLog
- Eksisterende fieldHistory overskrives ikke ved hydrate/load
- Opgave #77 i Review med cursor-verifikation`,

  "t-79": `Mål: Kolonne-flyt skal altid opdatere task.status og bevare Bobler/Archived ved reload og DB-gem.
Scope: stardesk-workboard.canvas.tsx — moveTask, hydrateTasks, kolonne-drop, compact-kolonner, bulk-import snapshot.
Output:
- hydrateTasks bevarer eksisterende status for alle kendte task-id'er (aldrig seed-reset)
- Kolonne-drop virker på tom flade (fjern currentTarget-guard) og i compact-kolonner
- DB auto-save bruger seneste tasks-snapshot (ikke stale closure)
Acceptkriterier:
- Træk til Bobler/Archived → status matcher kolonne med det samme
- Reload canvas → opgave stadig i Bobler/Archived
- Gem til Neon overskriver ikke med gammel status fra tidligere render`,

  "t-80": `Mål: Automatisk gem af Review-leverance (og plan/review-forberedelse) uden manuel Gem-knap.
Scope: stardesk-workboard.canvas.tsx — ReviewPanel, AgentPlanPanel, ReviewPrepPanel, approveReviewTask, moveTask.
Output:
- Debounced auto-save (1,5 s) for reviewDelivery, agentPlan og reviewPrep med fieldHistory + activityLog
- Fjern «Gem leverance», «Gem plan» og «Gem i Work Board-data» som påkrævet handling
- Godkend og kolonne-flyt flusher pending drafts synkront (applyPendingDraftsInline)
- Dansk hint: «Ændringer gemmes automatisk»
Acceptkriterier:
- Bruger redigerer leverance i Review — gemmes uden knap; fieldHistory opdateres ved reel ændring
- Godkend bruger seneste draft selv uden manuel gem
- Agent flytter til Review med leverance — persisteres via applyPendingDraftsInline/submitForReview
- Opgave #80 i Review med reviewVerificationScope cursor`,

  "t-81": `Mål: fieldHistory (Versionshistorik) skal altid appende — aldrig overskrive eksisterende arrays.
Scope: stardesk-workboard.canvas.tsx — appendFieldHistoryIfChanged, hydrateTasks, patchTaskFields, backfillAgentPlanIfNeeded, commit/auto-save paths; scripts/backfill-agent-plan.mjs.
Output:
- mergeFieldHistoryPreserved + preservePersistedFieldHistory ved hydrate
- appendFieldHistoryIfChanged seed forrige værdi når historik tom
- patchTaskFields og inline patch merger fieldHistory (append-only)
- Commit/auto-save bruger prev direkte (ikke hydrate-on-write)
- backfillAgentPlanIfNeeded springer over når agentPlan eller historik findes
Acceptkriterier:
- To plan-redigeringer giver 2+ fieldHistory.agentPlan entries; gamle bevares
- Reload canvas bevarer historik-længde
- Hydrate/auto-archive tick må ikke truncate fieldHistory
- Opgave #81 i Review med reviewVerificationScope cursor`,

  "t-85": `Mål: Automatisk Agent Review-verifikation når opgave flyttes til Agent Review — Cursor review-agent + Playwright (stardesk) + Human Review-gates.
Scope:
- stardesk-workboard.canvas.tsx: Task.agentReviewEvidence, buildAgentReviewPrompt, startAgentReviewAgent, AgentReviewEvidencePanel
- Ved Review-transition: agentReviewEvidence pending + newComposerChat (som I gang)
- scope stardesk: reviewPlaywrightEvidence pending + hybrid method; scope cursor: canvas/code method
- submitToHumanReview: bloker ved agentReviewEvidence failed; advar ved pending/running
- STARDESK/.cursor/skills/stardesk-agent-review/SKILL.md; docs/review-playwright-agent.md; stardesk-workboard.mdc
Flow:
1. I gang → Agent Review: applyReviewTransitionEvidence + auto-start review-agent
2. Agent læser skill, kører Playwright (stardesk) og/eller kode/canvas review
3. Agent opdaterer agentReviewEvidence (passed/failed, humanReviewHandoff)
4. Send til Human Review kun når passed (eller advarsel ved pending)
Output:
- Agent Review-verifikation banner i sag-detalje
- Start Agent Review-agent knap (retry)
- Skill til subagents (Playwright, kode, canvas, hybrid)
Acceptkriterier:
- Auto-chat ved skift til Agent Review (canvas åbent)
- agentReviewEvidence persisted på opgave
- Failed blokerer Human Review; pending viser advarsel
- Opgave #85 verificeres i Cursor (reviewVerificationScope cursor)`,

  "t-95": `Mål: Gem-knappen gemmer lokalt til canvas.data.json (UI-cache), ikke Neon bulk-import.
Scope: stardesk-workboard.canvas.tsx — toolbar Gem, Database-sync panel, draft flush.
Output:
- Gem: flush pending drafts → merge into stardesk-tasks-v1 → toast «Gemt lokalt kl. HH:MM»
- Status ved Gem: «Gemt lokalt kl. …» (ikke Neon-fejl)
- Database-sync: «Gem til Neon» + valgfri auto-gem toggle (default fra)
- Hint-tekst: lokal gem vs Neon
Acceptkriterier:
- Klik Gem uden API-token gemmer lokalt uden «Fejl Database-sync»
- Neon-sync kun via Database-sync / auto-toggle med token
- Opgave #95 i Agent Review med reviewVerificationScope cursor`,

  "t-96": `Mål: To tydelige review-kasser (Agent Review + Human Review) på Work Board — kolonner og sag-detalje.
Scope: stardesk-workboard.canvas.tsx — ReviewColumnGuideBox, REVIEW_STAGE_HINTS, ReviewPanel reviewStage/stageActive, dual layout i sag-detalje.
Output:
- Agent Review- og Human Review-kolonner: guide-kasse med header + hint (som screenshot)
- Sag-detalje i review: begge kasser stablet; aktiv kasse fuld, inaktiv kompakt med status
- reviewStage prop på ReviewPanel; verification scope kun i Agent Review-boks
Acceptkriterier:
- Kanban: guide-kasser i Review- og Human Review-kolonner
- Sag-detalje: Agent Review + Human Review kasser synlige samtidig
- Aktiv stage har actions; inaktiv viser afventer/bestået hint
- Opgave #96 i Agent Review med reviewVerificationScope cursor`,

  "t-97": `Mål: Lille tegneserie-and i agent topbar ved siden af klokken på forsiden/dashboard.
Scope: apps/web/src/components/agent/agent-topbar-duck.tsx, agent-top-bar.tsx.
Output:
- SVG comic-style and (gul krop, orange næb, tykke outlines) ~28px
- Placeret til venstre for AgentClock i wire-topbar__end (sm+ breakpoint)
- Dekorativ; title «Quack!»; aria-hidden
Acceptkriterier:
- And synlig ved siden af klokken på staff-sider (Dashboard m.fl.)
- Skjules på mobil sammen med klokken
- Ingen layout-brud i topbar
- Opgave #97 i Agent Review med reviewVerificationScope stardesk`,

  "t-88": `Mål: Eksplicit downstream-handoff I gang → Agent Review → Human Review → Done med auto-transitions og gates.
Scope:
- stardesk-workboard.canvas.tsx: appendWorkflowTransitionActivity, promotePassedAgentReviewTasks, AGENT_REVIEW_AUTO_HUMAN_ON_PASSED
- submitForReview → Agent Review + auto-start review-agent; submitToHumanReview + validateWorkboardStatusChange gates
- Bloker Human Review ved agentReviewEvidence failed/pending/running (og Playwright pending/failed for stardesk)
- Kolonne-hints + I gang/Agent Review panel-hints på dansk
- stardesk-workboard.mdc downstream-diagram; KANBAN #88
Flow:
1. I gang: agent bygger → leverance + agentPlan → Agent Review (log: Implementering færdig → Agent Review)
2. Agent Review: auto-start review-agent → agentReviewEvidence passed → auto Human Review (log: Agent review bestået → Human Review)
3. Human Review: Jan godkender → Done eller afviser → I gang
Output:
- Semi-auto: passed → auto Human Review; one-click «Send til Human Review» når passed allerede
- Disabled «→ Human Review» på kort når gate blokerer
Acceptkriterier:
- I gang kan ikke springe til Human Review eller Done
- Agent Review kan ikke godkendes direkte til Done
- Pending/failed blokerer Human Review
- Opgave #88 i Review med reviewVerificationScope cursor`,

  "t-89": `Mål: Agent Review-panel med tydelig LEVERANCE + nyt AGENT VIEW felt (verifikationsplan/resultater).
Scope:
- stardesk-workboard.canvas.tsx: Task.agentReviewView, ReviewPanel layout, auto-save, fieldHistory
- Synk agentReviewView fra agentReviewEvidence (summary, findings, method, status)
- Human Review: LEVERANCE + AGENT VIEW read-only for Jan
- Skjul generisk «Overskrift» i Agent/Human Review; LEVERANCE er hovedfelt
Output:
- LEVERANCE (reviewDeliverySummary) prominent i Agent Review
- AGENT VIEW textarea med «Sådan verificeres:» + «Verificeret:»
- Evidence banner reflekterer agentReviewEvidence.status
Acceptkriterier:
- Agent Review viser LEVERANCE + AGENT VIEW + scope + evidence banner
- Human Review viser begge felter read-only
- Auto-save + fieldHistory.agentReviewView append
- Opgave #89 i Review med reviewVerificationScope cursor`,

  "t-100": `Mål: Agent Review som AC-matrix — review-agent holder leverance op mod funktionelle og tekniske acceptkriterier; Playwright som bevis ved stardesk.
Scope:
- parseAcceptCriteriaFromDescription, mergeAcceptCriteriaForDisplay, buildAcceptCriteriaVerificationLines
- agentReviewEvidence.acceptCriteria array; synk til agentReviewView og AcceptCriteriaMatrixPanel
- buildAgentReviewPrompt: obligatorisk acceptCriteria før passed; LEVERANCE Jan-guide
- stardesk-agent-review SKILL.md; REVIEW_STAGE_HINTS opdateret
Output:
- AGENT VIEW viser Funktionelle/Tekniske AC med ✅/❌ og metode (playwright/kode/canvas)
- Evidence-panel: AC-tæller (fx 8/8 bestået)
- Review-prompt: kerneopgave = spec-AC, ikke kun Playwright
Acceptkriterier:
- Spec med Acceptkriterier parses til matrix i Agent Review
- Review-agent udfylder acceptCriteria; passed kun når alle AC passed/skipped
- Human Review viser matrix read-only i agent view
- Opgave #100 i Review med reviewVerificationScope cursor`,
};

function withCodingSpec(taskId: string, summary: string): string {
  const spec = CODING_SPECS[taskId];
  if (!spec) return summary;
  return `${summary}\n\n${SPEC_MARKER}\n\n${spec}`;
}

type TaskSpecSection = { label: string; body: string };

function stripDescriptionWorkflowNoise(text: string): string {
  let next = text;
  for (const marker of [
    REVIEW_REJECTED_MARKER,
    AGENT_RERUN_MARKER,
    REVIEW_DELIVERY_MARKER,
  ]) {
    const idx = next.indexOf(marker);
    if (idx >= 0) next = next.slice(0, idx);
  }
  return next.trim();
}

function parseSpecSections(specText: string): TaskSpecSection[] {
  const lines = specText.split("\n");
  const sections: TaskSpecSection[] = [];
  let current: { label: string; lines: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(/^(Mål|Scope|Flow|Output|Acceptkriterier):\s*(.*)$/i);
    if (match) {
      if (current) {
        sections.push({ label: current.label, body: current.lines.join("\n").trim() });
      }
      const label =
        match[1]!.charAt(0).toUpperCase() + match[1]!.slice(1).toLowerCase();
      const rest = match[2]?.trim() ?? "";
      current = { label, lines: rest ? [rest] : [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      sections.push({ label: "Overblik", body: line.trim() });
    }
  }
  if (current) {
    sections.push({ label: current.label, body: current.lines.join("\n").trim() });
  }
  if (sections.length === 0 && specText.trim()) {
    return [{ label: "Spec", body: specText.trim() }];
  }
  return sections.filter((section) => section.body.length > 0);
}

function parseTaskDescriptionForView(description: string): {
  intro: string | null;
  specSections: TaskSpecSection[];
} {
  const specIdx = description.indexOf(SPEC_MARKER);
  const introRaw = specIdx >= 0 ? description.slice(0, specIdx) : description;
  const intro = stripDescriptionWorkflowNoise(introRaw);
  const introText = intro.length > 0 ? intro : null;

  if (specIdx < 0) {
    return { intro: introText, specSections: [] };
  }

  const specRaw = description.slice(specIdx + SPEC_MARKER.length);
  const specClean = stripDescriptionWorkflowNoise(specRaw);
  return { intro: introText, specSections: parseSpecSections(specClean) };
}

function SpecSectionBody({
  body,
  theme,
}: {
  body: string;
  theme: ReturnType<typeof useHostTheme>;
}) {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const listLike = lines.length > 0 && lines.every((line) => /^[-•]\s/.test(line));

  if (listLike) {
    return (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {lines.map((line, index) => (
          <li key={`${index}-${line}`} style={{ marginBottom: 6 }}>
            <Text
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: theme.text.primary,
              }}
            >
              {line.replace(/^[-•]\s*/, "")}
            </Text>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Text
      style={{
        fontSize: 14,
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
        color: theme.text.primary,
      }}
    >
      {body}
    </Text>
  );
}

function DetailSectionStickyHeader({
  theme,
  children,
}: {
  theme: ReturnType<typeof useHostTheme>;
  children: JSX.Element | string;
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        margin: "-16px -16px 12px",
        padding: "14px 16px 10px",
        background: theme.fill.secondary,
        borderBottom: `1px solid ${theme.stroke.tertiary}`,
      }}
    >
      {children}
    </div>
  );
}

function TaskDescriptionBriefPanel({
  task,
  theme,
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
}) {
  const { intro, specSections } = parseTaskDescriptionForView(task.description);
  const acceptSection = specSections.find((section) =>
    section.label.toLowerCase().startsWith("accept"),
  );
  const otherSections = specSections.filter(
    (section) => !section.label.toLowerCase().startsWith("accept"),
  );

  return (
    <Stack
      gap={12}
      style={{
        border: `1px solid ${theme.stroke.primary}`,
        borderRadius: 8,
        padding: 16,
        background: theme.bg.elevated,
      }}
    >
      <DetailSectionStickyHeader theme={theme}>
        <Text weight="semibold" style={{ fontSize: 16, lineHeight: 1.35 }}>
          Opgavebeskrivelse
        </Text>
      </DetailSectionStickyHeader>

      {intro ? (
        <Text
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            color: theme.text.secondary,
          }}
        >
          {intro}
        </Text>
      ) : null}

      {specSections.length > 0 ? (
        <Stack gap={10}>
          <Text
            size="small"
            tone="tertiary"
            style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            Kodningsklar spec
          </Text>
          {otherSections.map((section) => (
            <Stack key={section.label} gap={4}>
              <Text weight="semibold" style={{ fontSize: 13 }}>
                {section.label}
              </Text>
              <SpecSectionBody body={section.body} theme={theme} />
            </Stack>
          ))}
          {acceptSection ? (
            <Stack
              gap={6}
              style={{
                borderTop: `1px solid ${theme.stroke.primary}`,
                paddingTop: 12,
                marginTop: 2,
              }}
            >
              <Text weight="semibold" style={{ fontSize: 14, color: theme.accent.primary }}>
                Acceptkriterier
              </Text>
              <SpecSectionBody body={acceptSection.body} theme={theme} />
            </Stack>
          ) : null}
        </Stack>
      ) : intro ? null : (
        <Text size="small" tone="secondary">
          Ingen kodningsklar spec endnu. Tilføj «{SPEC_MARKER}» i beskrivelsen nedenfor.
        </Text>
      )}
    </Stack>
  );
}

type DetailPanelEdge = "description-plan" | "plan-review";

type DetailPanelResizingState = {
  edge: DetailPanelEdge;
  startY: number;
  startHeights: DetailPanelHeightsFixed;
} | null;

function clampDetailPanelHeight(height: number): number {
  return Math.max(DETAIL_PANEL_HEIGHT_MIN, Math.min(DETAIL_PANEL_HEIGHT_MAX, height));
}

function DetailPanelResizeHandle({
  theme,
  title,
  active,
  onMouseDown,
  onResetAuto,
}: {
  theme: ReturnType<typeof useHostTheme>;
  title: string;
  active?: boolean;
  onResetAuto?: () => void;
  onMouseDown: (event: { clientY: number; preventDefault: () => void; stopPropagation: () => void }) => void;
}) {
  return (
    <div
      title={title}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onMouseDown(event);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onResetAuto?.();
      }}
      style={{
        height: 8,
        cursor: "ns-resize",
        background: active ? theme.fill.secondary : theme.stroke.tertiary,
        opacity: active ? 0.9 : 0.45,
        borderRadius: 4,
        flexShrink: 0,
      }}
    />
  );
}

function ResizableDetailSection({
  height,
  contentLineCount = 0,
  children,
}: {
  height: number | "auto";
  contentLineCount?: number;
  children: JSX.Element | JSX.Element[] | null;
}) {
  const isAuto = height === "auto";
  const capScroll = isAuto && contentLineCount > DETAIL_PANEL_AUTO_SCROLL_LINE_CAP;

  if (isAuto && !capScroll) {
    return (
      <div
        style={{
          minHeight: DETAIL_PANEL_HEIGHT_MIN,
          flexShrink: 1,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        height: isAuto ? undefined : height,
        minHeight: DETAIL_PANEL_HEIGHT_MIN,
        maxHeight: capScroll ? DETAIL_PANEL_AUTO_MAX_HEIGHT : undefined,
        overflow: "auto",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function AgentPlanPanel({
  task,
  theme,
  draft,
  onDraftChange,
  readOnly,
  autoSaveStatus = "idle",
}: {
  task: Task;
  theme: ReturnType<typeof useHostTheme>;
  draft: string;
  onDraftChange: (value: string) => void;
  readOnly: boolean;
  autoSaveStatus?: AutoSaveStatus;
}) {
  const stored = task.agentPlan?.trim() ?? "";
  const when = formatActivityWhen(task.agentPlanAt ?? null);
  const planReady = hasAgentPlanReady(task, readOnly ? stored : draft);

  return (
    <Stack
      gap={10}
      style={{
        border: `1px solid ${theme.stroke.primary}`,
        borderRadius: 8,
        padding: 16,
        background: theme.bg.elevated,
        minHeight: "100%",
      }}
    >
      <DetailSectionStickyHeader theme={theme}>
        <Row gap={8} align="center" justify="space-between" wrap>
          <Text weight="semibold" style={{ fontSize: 16, lineHeight: 1.35 }}>
            Plan (Cursor)
          </Text>
          {when ? (
            <Text size="small" tone="tertiary">
              {when} · {formatActivityActor(task.agentPlanActor)}
            </Text>
          ) : null}
        </Row>
      </DetailSectionStickyHeader>

      {readOnly ? (
        stored ? (
          <Text
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
              color: theme.text.primary,
            }}
          >
            {stored}
          </Text>
        ) : (
          <Text size="small" tone="secondary">
            Ingen plan endnu — agent udfylder ved I gang/Review
          </Text>
        )
      ) : (
        <>
          <Text size="small" tone="secondary">
            Beskriv konkrete trin agent tog eller planlægger (min. 80 tegn). Ændringer gemmes
            automatisk.
          </Text>
          <TextArea
            rows={textareaRowsForContent(draft || stored, { floor: 4, ceiling: 20, preferredMin: 4 })}
            value={draft || stored}
            onChange={onDraftChange}
            placeholder={"1. Læs spec …\n2. Implementér …\n3. Verificér acceptkriterier …"}
          />
          <Row gap={8} align="center" wrap>
            {autoSaveStatus === "pending" ? (
              <Text size="small" tone="secondary" weight="semibold">
                Gemmer automatisk…
              </Text>
            ) : autoSaveStatus === "saved" ? (
              <Text size="small" tone="tertiary">
                Gemt
              </Text>
            ) : !planReady ? (
              <Text size="small" tone="secondary">
                Min. 80 tegn påkrævet til Review.
              </Text>
            ) : (
              <Text size="small" tone="tertiary">
                Ændringer gemmes automatisk
              </Text>
            )}
          </Row>
        </>
      )}

      <CollapsibleVersionHistory
        entries={task.fieldHistory?.agentPlan ?? []}
        theme={theme}
      />
    </Stack>
  );
}

const seedTasks: Task[] = [
  // P0 — start her
  {
    id: "t-24",
    title: "Preprod-miljø",
    description: withCodingSpec(
      "t-24",
      "Opret separat preprod med deploy, env vars, DB og verificeringsflow før prod.",
    ),
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "env,preprod,deploy,db",
    source: "Backlog",
  },
  {
    id: "t-3",
    title: "Testsystem + patch/restore",
    description: withCodingSpec(
      "t-3",
      "Sæt testsystem op med restore-kontrol og daglig vurdering af patch-behov.",
    ),
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "test,restore,patch",
    source: "Backlog",
  },
  {
    id: "t-11",
    title: "Hurtig restore (DB + system)",
    description: withCodingSpec("t-11", "Restore med configs i test, hvis muligt."),
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "restore,ops",
    source: "Backlog",
  },
  {
    id: "t-21",
    title: "Sentry + Playwright",
    description: withCodingSpec("t-21", "Observability og E2E på kritiske flows i CI."),
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "sentry,playwright,ci",
    source: "Backlog",
  },
  {
    id: "t-17",
    title: "Password-kompleksitet",
    description: "Stram password-politik i app og API.",
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "security,auth,password",
    source: "Backlog",
  },
  {
    id: "t-26",
    title: "Coverage pipelines (web + api)",
    description: withCodingSpec(
      "t-26",
      "Generér coverage i CI før SonarScanner, med stabile rapportstier/formater.",
    ),
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "coverage,ci,web,api",
    source: "Backlog",
  },
  {
    id: "t-27",
    number: 27,
    parentId: "t-26",
    title: "Sonar import + quality forbedringer (batch #1)",
    description: withCodingSpec(
      "t-27",
      "Importér coverage i SonarCloud og luk P0/P1 findings uden regression.",
    ),
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "sonar,quality-gate,security,reliability",
    source: "Backlog",
  },
  {
    id: "t-23",
    title: "Sonar-fixes (batches)",
    description:
      "Fortsæt fixes på hele kodebasen: security/reliability først, derefter code smells.",
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "sonar,security,reliability",
    source: "Backlog",
  },
  {
    id: "t-22",
    title: "n8n Sonar-agent",
    description: withCodingSpec(
      "t-22",
      "Kør sonar-agent hver anden dag med sikre secrets og notifikation med rapport-summary.",
    ),
    status: "Backlog",
    priority: "P0",
    owner: "",
    tags: "n8n,sonar,automation",
    source: "Backlog",
  },
  {
    id: "t-44",
    title: "n8n Quality Loop (Sonar + Destructive)",
    description: withCodingSpec(
      "t-44",
      "n8n-loop hver 2. dag: Sonar-agent + destructive smoke + Cursor agent-prompt med skills.",
    ),
    status: "Review",
    priority: "P0",
    owner: "",
    tags: "n8n,sonar,destructive,automation,skills",
    source: "Canvas",
  },

  // P1 — sikkerhed, GDPR og compliance
  {
    id: "t-4",
    title: "Sikkerhedsafklaring",
    description: withCodingSpec(
      "t-4",
      "Konkret: “hvordan hacker I løs på det” omsat til en plan.",
    ),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "security,threat-model",
    source: "Backlog",
  },
  {
    id: "t-14",
    title: "CPR-data feltkontrol",
    description: withCodingSpec("t-14", "Validering og maskering af CPR-relaterede felter."),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "cpr,gdpr,validation,masking",
    source: "Backlog",
  },
  {
    id: "t-25",
    title: "GDPR-gateway → Jira Service Desk",
    description: withCodingSpec(
      "t-25",
      "Send sager uden GDPR fuldt; maskér/redigér sager med GDPR via regex; API-nøgle + opret-kommando og hooks begge veje.",
    ),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "gdpr,jira,regex,webhooks",
    source: "Backlog",
  },

  // P1 — kerne: sager og administration (hurtige wins)
  {
    id: "t-18",
    title: "Flytning til modtagergruppe",
    description: withCodingSpec("t-18", "Verificér flyt og gem på modtagergruppe (regression)."),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "routing,groups,assignment",
    source: "Backlog",
  },
  {
    id: "t-9",
    title: "Stor-sag markering",
    description: withCodingSpec(
      "t-9",
      "Filter + badge + tydelig visning på ikke-løste store sager (fx rød stribe).",
    ),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "major,incidents,ui",
    source: "Backlog",
  },
  {
    id: "t-7",
    title: "Hover-preview på sager",
    description: withCodingSpec("t-7", "Se indhold ved hover i sag-lister."),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "ui,preview,ux",
    source: "Backlog",
  },
  {
    id: "t-10",
    title: "Brugeradministrationsside",
    description: withCodingSpec("t-10", "Få manglende brugeradministrationsside med i UI."),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "admin,users,ui",
    source: "Backlog",
  },
  {
    id: "t-16",
    title: "Visuelt overlay for relaterede sager",
    description: "Vis relationer mellem sager i et visuelt overlay.",
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "ui,relations,overlay",
    source: "Backlog",
  },
  {
    id: "t-28",
    number: 28,
    title: "Admin layout-redigering på alle sider",
    description: withCodingSpec(
      "t-28",
      "Global knap for administratorer: flyt felter, omdøb, udvid/skjul pr. side; gem layout pr. route; udvid til alle views.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "admin,layout,ux,customization",
    source: "Backlog",
  },
  {
    id: "t-33",
    number: 33,
    title: "I gang / Review flow",
    description: withCodingSpec(
      "t-33",
      "Anmod I gang fra Backlog/Ready; Klar til review fra I gang.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "workflow,in-progress,review,workboard",
    source: "Backlog",
  },
  {
    id: "t-32",
    number: 32,
    title: "Review: godkend / afvis",
    description: withCodingSpec(
      "t-32",
      "Godkend → Done. Afvis med begrundelse → I gang (agent genstarter).",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "review,workflow,approval,workboard",
    source: "Backlog",
  },
  {
    id: "t-30",
    number: 30,
    title: "Sidebar: pæn øje-legend ved smal kolonne",
    description: withCodingSpec(
      "t-30",
      "Kompakt visning af synlighedstekst når venstre nav er smal — ingen brudte ord.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "ui,sidebar,nav,responsive",
    source: "Backlog",
  },
  {
    id: "t-31",
    number: 31,
    title: "Aktiver: resizable kolonner",
    description: withCodingSpec(
      "t-31",
      "Ændringslog, aktivtræ og verdenskort/detalje kan trækkes bredere eller smallere.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "ui,aktiver,resize,layout",
    source: "Backlog",
  },
  {
    id: "t-29",
    number: 29,
    title: "Sagsflow-agent (Review → Done)",
    description: withCodingSpec(
      "t-29",
      "Agent: flyt til Review når sagen er færdig udfyldt; flyt til Done når den er lukket.",
    ),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "agent,workflow,kanban,review,done,automation",
    source: "Backlog",
  },
  {
    id: "t-46",
    number: 46,
    title: "Work Board: kolonne-titel synlig ved alle bredder",
    description: withCodingSpec(
      "t-46",
      "Kolonne-navn skal kunne ses i smal, medium og bred visning — sorteringsfelt må ikke skjule titlen.",
    ),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "ui,workboard,kanban,responsive,canvas",
    source: "Backlog",
  },
  {
    id: "t-48",
    number: 48,
    title: "Work Board: verifikationslink i Review",
    description: withCodingSpec(
      "t-48",
      "Fast STARDESK-link i Review så reviewer kan verificere manuelt før Godkend.",
    ),
    status: "Backlog",
    priority: "P1",
    owner: "",
    tags: "workboard,review,canvas,verification",
    source: "Backlog",
  },

  // P2 — integrationer
  {
    id: "t-5",
    title: "Keycloak + AI-flow",
    description: withCodingSpec(
      "t-5",
      "Login/flow for indmelding, godkendelse og AI auto-oprettelse (inkl. afklaringsspørgsmål).",
    ),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "keycloak,ai,auth",
    source: "Backlog",
  },
  {
    id: "t-2",
    title: "Slack (basis)",
    description: withCodingSpec("t-2", "Grundintegration til Slack."),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "slack,basic",
    source: "Backlog",
  },
  {
    id: "t-6",
    number: 6,
    parentId: "t-2",
    title: "Slack sagssync (hooks)",
    description: withCodingSpec("t-6", "Sager ind i Slack og opdateres begge veje via hooks."),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "slack,sync,webhooks",
    source: "Backlog",
  },
  {
    id: "t-8",
    number: 8,
    parentId: "t-2",
    title: "Slack mentions",
    description: withCodingSpec("t-8", "Mention/prik til folk i Slack fra STARdesk."),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "slack,mentions",
    source: "Backlog",
  },
  {
    id: "t-13",
    number: 13,
    parentId: "t-25",
    title: "Jira tovejssynk",
    description: withCodingSpec(
      "t-13",
      "Push/pull mellem STARdesk og Jira med feltmapping og idempotens.",
    ),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "jira,sync,webhooks",
    source: "Backlog",
  },

  // P3 — CMDB, assets og forretningsregler
  {
    id: "t-1",
    title: "Assetliste + ITIL-standardklasser",
    description: withCodingSpec(
      "t-1",
      "Integreret assetliste med standardklasser og standardattributter.",
    ),
    status: "Backlog",
    priority: "P3",
    owner: "",
    tags: "assets,itil,cmdb",
    source: "Backlog",
  },
  {
    id: "t-19",
    title: "Business-regler + Golden Store",
    description: withCodingSpec("t-19", "Opsæt business-regler og verificér dem mod golden store."),
    status: "Backlog",
    priority: "P3",
    owner: "",
    tags: "rules,golden,verification",
    source: "Backlog",
  },

  {
    id: "t-50",
    number: 50,
    title: "Omdøb kolonne-titler (dobbeltklik)",
    description: withCodingSpec(
      "t-50",
      "Kolonne-titler på Work Board kan omdøbes via dobbeltklik og gemmes i canvas data.",
    ),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,ux",
    source: "Backlog",
  },

  {
    id: "t-51",
    number: 51,
    title: "Én leverance-sektion i sag-detalje",
    description: withCodingSpec(
      "t-51",
      "Fjern duplikat «Leverance til review» i sag-detalje og forbedre edit-formularens UI.",
    ),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,ux,review",
    source: "Backlog",
  },

  {
    id: "t-52",
    number: 52,
    title: "Kompakte hovedsag/underopgave-knapper",
    description: withCodingSpec(
      "t-52",
      "Hovedsag-vælger og «Opret underopgave» skal være små inline-knapper — ikke fuld bredde.",
    ),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,ux",
    source: "Backlog",
  },

  {
    id: "t-55",
    number: 55,
    title: "Samlet Review-panel (leverance + godkend)",
    description: withCodingSpec(
      "t-55",
      "Merge review og leverance til review til ét panel — godkend/afvis i samme kort som leverancefelter.",
    ),
    status: "Review",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,ux,review",
    source: "Canvas",
  },
  {
    id: "t-56",
    number: 56,
    title: "Leverance: konkret gennemført arbejde i Review",
    description: withCodingSpec(
      "t-56",
      "Hård regel: Leverance i Review skal beskrive konkret gennemført arbejde — ikke Planlagt leverance eller generiske placeholders.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "workboard,canvas,review,rules",
    source: "Canvas",
  },
  {
    id: "t-59",
    number: 59,
    title: "Agent-plan panel i sag-detalje",
    description: withCodingSpec(
      "t-59",
      "Vis Cursor agents plan mellem opgavebeskrivelse og Review — tre resizable paneler.",
    ),
    status: "Review",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,ux,review,agent",
    source: "Canvas",
  },
  {
    id: "t-70",
    number: 70,
    title: "Aktivitetslog foldbar i sag-detalje",
    description: withCodingSpec(
      "t-70",
      "Aktivitetslog skal være foldet ind som standard og ekspanderes ved klik — som Versionshistorik.",
    ),
    status: "Review",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,ux,activity-log",
    source: "Canvas",
  },
  {
    id: "t-73",
    number: 73,
    title: "Afvis-begrundelse: indsæt skærmbilleder",
    description: withCodingSpec(
      "t-73",
      "Review-afvisningsfelt skal understøtte Ctrl+V med skærmbilleder, thumbnail-preview og persistens på opgaven.",
    ),
    status: "Review",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,review,ux,images",
    source: "Canvas",
  },
  {
    id: "t-78",
    number: 78,
    title: "Afvis: upload video + upload-knap",
    description: withCodingSpec(
      "t-78",
      "Review-afvisning skal have upload-knap til billede og video (fx bug der ikke kan udvides) med preview og persistens til agent-genkørsel.",
    ),
    status: "Review",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,review,ux,video,attachments",
    source: "Canvas",
  },
  {
    id: "t-74",
    number: 74,
    title: "Playwright-evidence ved Review",
    description: withCodingSpec(
      "t-74",
      "Efter I gang→Review: ekstern Playwright-agent logger ind på deployed STARDESK, smoke-verificerer reviewVerificationUrl og gemmer screenshots i reviewPlaywrightEvidence på opgaven.",
    ),
    status: "Backlog",
    priority: "P2",
    owner: "",
    tags: "workboard,playwright,review,e2e,automation",
    source: "Canvas",
  },
  {
    id: "t-76",
    number: 76,
    title: "Work Board: Gem-knap + auto-save til DB",
    description: withCodingSpec(
      "t-76",
      "Manuel Gem-knap og auto-save hvert 5. minut persisterer alle opgaver til Neon via bulk-import API.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "workboard,canvas,persistence,db",
    source: "Canvas",
  },
  {
    id: "t-77",
    number: 77,
    title: "Versionshistorik + aktivitetslog ved alle ændringer",
    description: withCodingSpec(
      "t-77",
      "Tracked felter (description, agentPlan, reviewDeliverySummary, reviewPrepSummary) skal appende fieldHistory og aktivitetslog ved hver Gem-handling.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "workboard,canvas,history,activity-log",
    source: "Canvas",
  },
  {
    id: "t-79",
    number: 79,
    title: "Status skift ved kolonne-flyt — Bobler/Archived",
    description: withCodingSpec(
      "t-79",
      "Træk mellem kolonner skal opdatere task.status med det samme og bevare Bobler/Lukket ved reload og database-gem.",
    ),
    status: "Review",
    priority: "P0",
    owner: "",
    tags: "workboard,canvas,kanban,status,bobler,archived",
    source: "Canvas",
  },
  {
    id: "t-81",
    number: 81,
    title: "Versionshistorik append-only — aldrig overskriv",
    description: withCodingSpec(
      "t-81",
      "fieldHistory (Versionshistorik) skal altid appende ved ændring — aldrig erstatte hele arrays ved hydrate, backfill eller gem.",
    ),
    status: "Review",
    priority: "P0",
    owner: "",
    tags: "workboard,canvas,history,fieldHistory,bugfix",
    source: "Canvas",
  },
  {
    id: "t-85",
    number: 85,
    title: "Agent Review auto-verifikation + skill",
    description: withCodingSpec(
      "t-85",
      "Ved skift til Agent Review: auto-start review-agent, agentReviewEvidence, Playwright-integration (stardesk), Human Review-gates og stardesk-agent-review skill.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "workboard,canvas,review,agent,playwright,automation",
    source: "Canvas",
  },
  {
    id: "t-88",
    number: 88,
    title: "Downstream: I gang → Agent Review → Human Review",
    description: withCodingSpec(
      "t-88",
      "Eksplicit downstream-handoff I gang → Agent Review → Human Review → Done med auto-transitions, gates og danske hints.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "workboard,canvas,workflow,review,human-review",
    source: "Canvas",
  },
  {
    id: "t-89",
    number: 89,
    title: "Agent Review: LEVERANCE + AGENT VIEW felter",
    description: withCodingSpec(
      "t-89",
      "Agent Review-panel: tydelig LEVERANCE (reviewDeliverySummary) + AGENT VIEW (agentReviewView) med verifikationsplan/resultater synket fra agentReviewEvidence.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "workboard,canvas,review,agent-review,ui",
    source: "Canvas",
  },
  {
    id: "t-95",
    number: 95,
    title: "Work Board: Gem-knap gemmer lokalt",
    description: withCodingSpec(
      "t-95",
      "Gem-knappen skal gemme til canvas.data.json (UI-cache), ikke Neon bulk-import. Database-sync bliver separat valgfri handling.",
    ),
    status: "Review",
    priority: "P1",
    owner: "",
    tags: "workboard,canvas,persistence,local-save",
    source: "Canvas",
  },
  {
    id: "t-96",
    number: 96,
    title: "Work Board: Agent + Human Review kasser",
    description: withCodingSpec(
      "t-96",
      "To review-kasser (Agent Review og Human Review) med guide-header i kanban-kolonner og dual layout i sag-detalje.",
    ),
    status: "Human Review",
    priority: "P2",
    owner: "",
    tags: "workboard,canvas,review,ui",
    source: "Canvas",
  },
  {
    id: "t-97",
    number: 97,
    title: "Topbar: tegneserie-and ved klokken",
    description: withCodingSpec(
      "t-97",
      "Lille comic-style and i agent topbar til venstre for klokken på staff-forsiden.",
    ),
    status: "Human Review",
    priority: "P3",
    owner: "",
    tags: "web,ui,topbar,easter-egg",
    source: "Canvas",
  },

  // Done
  {
    id: "t-done-attachments",
    number: 0,
    title: "Billeder gemmes og kan uploades/vises på sager",
    description: "Billeder gemmes, uploades og vises på sager.",
    status: "Done",
    priority: "P1",
    owner: "",
    tags: "attachments,images,ui",
    source: "Done",
  },
];

/**
 * User-mutable fields seedTasks must NEVER overwrite on existing task ids.
 * hydrateTasks only appends missing seed ids and fills documented structural gaps.
 */
const HYDRATE_USER_MUTABLE_KEYS = [
  "status",
  "priority",
  "title",
  "description",
  "owner",
  "tags",
  "source",
  "parentId",
  "createdAt",
  "activityLog",
  "fieldHistory",
  "reviewDeliveryHeading",
  "reviewDeliverySummary",
  "reviewDeliveryAt",
  "reviewVerificationUrl",
  "reviewVerificationLabel",
  "reviewVerificationScope",
  "reviewPrepHeading",
  "reviewPrepSummary",
  "reviewPrepSkills",
  "reviewPrepReviewer",
  "reviewPrepAt",
  "reviewPrepAgentStartedAt",
  "reviewDeliveryActor",
  "reviewPrepActor",
  "agentPlan",
  "agentPlanAt",
  "agentPlanActor",
  "agentRerunRequired",
  "agentRerunReason",
  "agentRerunAt",
  "reviewRejectAttachments",
  "reviewRejectImages",
  "reviewPlaywrightEvidence",
  "agentReviewEvidence",
  "agentReviewAgentStartedAt",
  "agentReviewView",
  "agentReviewViewAt",
  "agentReviewViewActor",
  "doneAt",
  "boardIndex",
] as const satisfies readonly (keyof Task)[];

function mergeSeedDefaultsWhenMissing(persisted: Task, seed: Task): Task {
  let next = persisted;
  // NEVER `{ ...seed, ...persisted }` or spread seed after persisted — status would reset to Backlog.
  if (!persisted.description.includes(SPEC_MARKER) && seed.description.includes(SPEC_MARKER)) {
    next = { ...next, description: seed.description };
  }
  if (seed.parentId && !persisted.parentId) {
    next = { ...next, parentId: seed.parentId };
  }
  if (typeof persisted.number !== "number" && typeof seed.number === "number") {
    next = { ...next, number: seed.number };
  }
  return next;
}

type HydrateStatusRegression = { id: string; from: Status; to: Status };

/** Human Review must never be downgraded by hydrate/tick/load — only explicit user/agent column moves. */
function isHydrateLockedStatus(status: Status): boolean {
  return status === "Human Review";
}

/** Recover tasks reverted to Review while still carrying passed evidence or promote activity. */
function recoverRevertedHumanReviewTask(task: Task): Task {
  if (task.status !== "Review") return task;
  if (task.agentReviewEvidence?.status === "passed") {
    return { ...task, status: "Human Review" };
  }
  const wasPromoted = (task.activityLog ?? []).some(
    (entry) => entry.action === "Agent review bestået → Human Review",
  );
  if (wasPromoted) {
    return { ...task, status: "Human Review" };
  }
  return task;
}

/** Block stale in-memory writes from downgrading Human Review → Review (open canvas during file promote). */
function guardHumanReviewDowngrades(next: Task[], prev: Task[]): Task[] {
  const prevById = new Map(prev.map((task) => [task.id, task]));
  return next.map((task) => {
    const was = prevById.get(task.id);
    if (
      was &&
      isHydrateLockedStatus(was.status) &&
      task.status === "Review"
    ) {
      return { ...task, status: was.status };
    }
    return task;
  });
}

/** Review → Human Review when agentReviewEvidence passed is an intentional auto-promote, not a regression. */
function isIntentionalAutoPromoteRegression(
  regression: HydrateStatusRegression,
  afterTask: Task,
): boolean {
  return (
    regression.from === "Review" &&
    regression.to === "Human Review" &&
    taskQualifiesForHumanReviewPromote(afterTask)
  );
}

/** Test helper: status must never change during hydration for existing ids (except allowed auto-promotes). */
function findHydrateStatusRegressions(before: Task[], after: Task[]): HydrateStatusRegression[] {
  const beforeById = new Map(before.map((task) => [task.id, task]));
  const regressions: HydrateStatusRegression[] = [];
  for (const task of after) {
    const prev = beforeById.get(task.id);
    if (prev && prev.status !== task.status) {
      const regression = { id: task.id, from: prev.status, to: task.status };
      // Human Review is locked — any change away from it is always a regression.
      if (isHydrateLockedStatus(prev.status)) {
        regressions.push(regression);
        continue;
      }
      if (isIntentionalAutoPromoteRegression(regression, task)) continue;
      regressions.push(regression);
    }
  }
  return regressions;
}

/** Never overwrite user column placement for tasks that already exist in persisted state. */
function preservePersistedStatuses(hydrated: Task[], persisted: Task[]): Task[] {
  const statusById = new Map(persisted.map((task) => [task.id, task.status]));
  return hydrated.map((task) => {
    const status = statusById.get(task.id);
    return status != null && task.status !== status ? { ...task, status } : task;
  });
}

/** Never overwrite persisted fieldHistory arrays during hydration backfills. */
function preservePersistedFieldHistory(hydrated: Task[], persisted: Task[]): Task[] {
  const persistedById = new Map(persisted.map((task) => [task.id, task]));
  return hydrated.map((task) => {
    const orig = persistedById.get(task.id);
    if (!orig) return task;
    const merged = mergeFieldHistoryPreserved(orig.fieldHistory, task.fieldHistory);
    if (fieldHistoryEqual(task.fieldHistory, merged)) return task;
    return { ...task, fieldHistory: merged };
  });
}

function hydrateTasksCore(current: Task[]): Task[] {
  const seedById = new Map(seedTasks.map((task) => [task.id, task]));
  const existing = new Set(current.map((t) => t.id));
  const merged = [...current];
  for (const seed of seedTasks) {
    if (!existing.has(seed.id)) merged.push(seed);
  }
  const withSpecs = merged.map((task) => {
    const seed = seedById.get(task.id);
    if (!seed) return task;
    return mergeSeedDefaultsWhenMissing(task, seed);
  });
  const backfilled = ensureTaskNumbers(
    withSpecs.map((task) =>
      syncAgentReviewViewFromEvidence(
        backfillAgentPlanIfNeeded(ensureFieldHistoryBackfill(backfillDoneAtIfNeeded(task))),
      ),
    ),
  );
  const withHistory = preservePersistedFieldHistory(backfilled, current);
  return preservePersistedStatuses(withHistory, current);
}

function hydrateTasks(current: Task[]): Task[] {
  return hydrateTasksCore(current);
}

function applyWorkflowAutoTransitions(current: Task[]): Task[] {
  const recovered = current.map(recoverRevertedHumanReviewTask);
  return promotePassedAgentReviewTasks(recovered);
}

/** Apply hydrate + regression guard + auto-archive in one pass (scheduleAutoArchiveChecks + tests). */
function reconcileHydratedTasks(prev: Task[]): {
  next: Task[];
  archivedCount: number;
  needsPersist: boolean;
} {
  const hydrated = applyWorkflowAutoTransitions(hydrateTasksCore(prev));
  const regressions = findHydrateStatusRegressions(prev, hydrated);
  const stable =
    regressions.length > 0 ? preservePersistedStatuses(hydrated, prev) : hydrated;
  const { next, archivedCount } = runAutoArchivePass(stable);
  const needsPersist =
    archivedCount > 0 || hydrationPersistNeedsUpdate(prev, next);
  return { next, archivedCount, needsPersist };
}

function isIntentionalHydrateStatusChange(before: Task, after: Task): boolean {
  return (
    before.status === "Review" &&
    after.status === "Human Review" &&
    taskQualifiesForHumanReviewPromote(after)
  );
}

/** True when hydration added seeds, safe backfills, or Review→Human Review auto-promote. */
function hydrationPersistNeedsUpdate(prev: Task[], hydrated: Task[]): boolean {
  if (hydrated.length !== prev.length) return true;
  const prevById = new Map(prev.map((task) => [task.id, task]));
  return hydrated.some((task) => {
    const before = prevById.get(task.id);
    if (!before) return true;
    if (before.status !== task.status) {
      return isIntentionalHydrateStatusChange(before, task);
    }
    return (
      before.doneAt !== task.doneAt ||
      before.agentPlan !== task.agentPlan ||
      before.agentReviewView !== task.agentReviewView ||
      before.activityLog !== task.activityLog ||
      before.fieldHistory !== task.fieldHistory ||
      before.agentReviewEvidence !== task.agentReviewEvidence
    );
  });
}

function priorityColor(priority: Priority, theme: ReturnType<typeof useHostTheme>) {
  if (priority === "P0") return theme.diff.deleted;
  if (priority === "P1") return theme.diff.renamed;
  if (priority === "P2") return theme.diff.added;
  return theme.text.tertiary;
}

/** Keyframes for I gang pulse (injected once per board mount). */
function WorkBoardPulseKeyframes() {
  return (
    <style>{`
      @keyframes stardesk-wb-pulse-ring {
        0% { transform: scale(1); opacity: 0.65; }
        70% { transform: scale(1.6); opacity: 0; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      @keyframes stardesk-wb-pulse-core {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(0.88); }
      }
    `}</style>
  );
}

const BOARD_SCROLL_VIEWPORT_ID = "stardesk-board-scroll-viewport";
const BOARD_SCROLL_TRACK_ID = "stardesk-board-scroll-track";
const BOARD_ZOOM_MIN = 0.5;
const BOARD_ZOOM_MAX = 1.5;
const BOARD_ZOOM_DEFAULT = 1;
const BOARD_ZOOM_STEP = 0.05;

function clampBoardZoom(value: number): number {
  return Math.max(BOARD_ZOOM_MIN, Math.min(BOARD_ZOOM_MAX, Math.round(value * 100) / 100));
}

function scheduleBoardScrollMetricsRefresh(): void {
  globalThis.requestAnimationFrame?.(() => {
    const viewport = getBoardScrollViewport();
    if (viewport && boardViewportSetMetrics) {
      applyBoardScrollMetricsUpdate(boardViewportSetMetrics, viewport);
    }
  });
}

let boardZoomApply: ((action: number | ((prev: number) => number)) => void) | null = null;

function handleBoardZoomWheel(event: WheelEvent): void {
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  const step = event.deltaY > 0 ? -BOARD_ZOOM_STEP : BOARD_ZOOM_STEP;
  boardZoomApply?.((prev) => {
    const next = clampBoardZoom(prev + step);
    if (next !== prev) scheduleBoardScrollMetricsRefresh();
    return next;
  });
}

type BoardScrollMetrics = { scrollWidth: number; clientWidth: number };

function boardScrollColumnId(column: Status): string {
  return `stardesk-board-col-${column.replace(/\s+/g, "-").toLowerCase()}`;
}

function getBoardScrollViewport(): HTMLDivElement | null {
  return document.getElementById(BOARD_SCROLL_VIEWPORT_ID) as HTMLDivElement | null;
}

function readBoardScrollMetrics(el: HTMLDivElement): BoardScrollMetrics {
  return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
}

type BoardScrollMetricsSetter = (
  action: BoardScrollMetrics | ((prev: BoardScrollMetrics) => BoardScrollMetrics),
) => void;

function applyBoardScrollMetricsUpdate(
  setMetrics: BoardScrollMetricsSetter,
  el: HTMLDivElement,
): void {
  const next = readBoardScrollMetrics(el);
  setMetrics((prev) =>
    prev.scrollWidth === next.scrollWidth && prev.clientWidth === next.clientWidth ? prev : next,
  );
}

/** Stable ref callback — inline refs re-fire every render and must not always setState. */
let boardViewportScrollRestore = 0;
let boardViewportSetMetrics: BoardScrollMetricsSetter | null = null;

function attachBoardViewportRef(el: HTMLDivElement | null): void {
  if (!el) return;
  if (el.dataset.scrollRestored !== "1" && boardViewportScrollRestore > 0) {
    el.scrollLeft = boardViewportScrollRestore;
    el.dataset.scrollRestored = "1";
  }
  if (boardViewportSetMetrics) {
    applyBoardScrollMetricsUpdate(boardViewportSetMetrics, el);
  }
  if (el.dataset.zoomWheelBound !== "1") {
    el.dataset.zoomWheelBound = "1";
    el.addEventListener("wheel", handleBoardZoomWheel, { passive: false });
  }
}

let boardScrollSyncRaf: number | null = null;
let boardScrollSyncEl: HTMLDivElement | null = null;
let boardScrollSyncSetLeft: ((action: number | ((prev: number) => number)) => void) | null = null;
let boardScrollSyncSetMetrics: BoardScrollMetricsSetter | null = null;

function scheduleBoardScrollSync(
  el: HTMLDivElement,
  setLeft: (action: number | ((prev: number) => number)) => void,
  setMetrics: BoardScrollMetricsSetter,
): void {
  boardScrollSyncEl = el;
  boardScrollSyncSetLeft = setLeft;
  boardScrollSyncSetMetrics = setMetrics;
  if (boardScrollSyncRaf != null) return;
  boardScrollSyncRaf =
    globalThis.requestAnimationFrame?.(() => {
      boardScrollSyncRaf = null;
      const target = boardScrollSyncEl;
      const setScrollLeft = boardScrollSyncSetLeft;
      const setMetrics = boardScrollSyncSetMetrics;
      if (!target || !setScrollLeft || !setMetrics) return;
      setScrollLeft((prev) => {
        const next = target.scrollLeft;
        return prev === next ? prev : next;
      });
      applyBoardScrollMetricsUpdate(setMetrics, target);
    }) ?? null;
}

function boardMaxScrollLeft(metrics: BoardScrollMetrics): number {
  return Math.max(0, metrics.scrollWidth - metrics.clientWidth);
}

function isBoardPanTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("button, input, textarea, a, select, [contenteditable=true]")) return false;
  if (target.closest("[draggable=true], [draggable]")) return false;
  if (target.closest("[data-board-card]")) return false;
  if (target.closest("[data-board-no-pan]")) return false;
  return true;
}

function WorkBoardScrollStyles({ theme }: { theme: ReturnType<typeof useHostTheme> }) {
  return (
    <style>{`
      .stardesk-board-scroll-viewport {
        overflow-x: auto;
        overflow-y: visible;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        scrollbar-width: auto;
        scrollbar-color: ${theme.stroke.primary} ${theme.bg.chrome};
        scrollbar-gutter: stable;
      }
      .stardesk-board-scroll-viewport::-webkit-scrollbar {
        height: 14px;
      }
      .stardesk-board-scroll-viewport::-webkit-scrollbar-track {
        background: ${theme.bg.chrome};
        border-radius: 8px;
      }
      .stardesk-board-scroll-viewport::-webkit-scrollbar-thumb {
        background: ${theme.fill.secondary};
        border: 2px solid ${theme.bg.chrome};
        border-radius: 8px;
        min-width: 48px;
      }
      .stardesk-board-scroll-viewport::-webkit-scrollbar-thumb:hover {
        background: ${theme.stroke.primary};
      }
    `}</style>
  );
}

function BoardScrollControls({
  setScrollLeft,
  onMetricsUpdate,
}: {
  setScrollLeft: (value: number) => void;
  onMetricsUpdate: (el: HTMLDivElement) => void;
}) {
  function syncFromViewport() {
    const el = getBoardScrollViewport();
    if (!el) return;
    setScrollLeft((prev) => {
      const next = el.scrollLeft;
      return prev === next ? prev : next;
    });
    onMetricsUpdate(el);
  }

  function scrollToColumn(column: Status) {
    const colEl = document.getElementById(boardScrollColumnId(column));
    colEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    globalThis.setTimeout?.(() => syncFromViewport(), 360);
  }

  return (
    <Row gap={6} align="center" wrap style={{ minWidth: 0 }}>
      <Text size="small" tone="secondary">
        Gå til kolonne:
      </Text>
      {COLUMNS.map((column) => (
        <Button
          key={column}
          type="button"
          variant="ghost"
          onClick={() => scrollToColumn(column)}
        >
          {COLUMN_SHORT_LABELS[column]}
        </Button>
      ))}
    </Row>
  );
}

function BoardScrollTrackBar({
  theme,
  scrollLeft,
  setScrollLeft,
  metrics,
  onMetricsUpdate,
}: {
  theme: ReturnType<typeof useHostTheme>;
  scrollLeft: number;
  setScrollLeft: (value: number) => void;
  metrics: BoardScrollMetrics;
  onMetricsUpdate: (el: HTMLDivElement) => void;
}) {
  const maxScroll = boardMaxScrollLeft(metrics);
  const canScroll = maxScroll > 0;
  const thumbWidthPercent = canScroll
    ? Math.max(8, (metrics.clientWidth / metrics.scrollWidth) * 100)
    : 100;
  const thumbTravelPercent = 100 - thumbWidthPercent;
  const thumbLeftPercent = canScroll && thumbTravelPercent > 0
    ? (scrollLeft / maxScroll) * thumbTravelPercent
    : 0;

  function syncFromViewport() {
    const el = getBoardScrollViewport();
    if (!el) return;
    setScrollLeft((prev) => {
      const next = el.scrollLeft;
      return prev === next ? prev : next;
    });
    onMetricsUpdate(el);
  }

  function scrollByStep(direction: -1 | 1) {
    const el = getBoardScrollViewport();
    if (!el) return;
    const step = Math.max(280, metrics.clientWidth * 0.72);
    const nextMax = boardMaxScrollLeft(readBoardScrollMetrics(el));
    el.scrollLeft = Math.max(0, Math.min(nextMax, el.scrollLeft + direction * step));
    syncFromViewport();
  }

  function startThumbDrag(startX: number) {
    const el = getBoardScrollViewport();
    const trackEl = document.getElementById(BOARD_SCROLL_TRACK_ID);
    if (!el || !trackEl || !canScroll) return;
    const trackRect = trackEl.getBoundingClientRect();
    const thumbTravelPx = trackRect.width * (thumbTravelPercent / 100);
    const startScroll = el.scrollLeft;

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      const scrollDelta = thumbTravelPx > 0 ? (delta / thumbTravelPx) * maxScroll : 0;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startScroll + scrollDelta));
    }

    function onUp() {
      globalThis.removeEventListener?.("mousemove", onMove);
      globalThis.removeEventListener?.("mouseup", onUp);
      setScrollLeft((prev) => {
        const next = el.scrollLeft;
        return prev === next ? prev : next;
      });
      onMetricsUpdate(el);
    }

    globalThis.addEventListener?.("mousemove", onMove);
    globalThis.addEventListener?.("mouseup", onUp);
  }

  function onTrackClick(event: { clientX: number; target: EventTarget | null; currentTarget: EventTarget | null }) {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    if (event.target instanceof HTMLElement && event.target.dataset.thumb === "1") return;
    const el = getBoardScrollViewport();
    if (!el || !canScroll) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    el.scrollLeft = ratio * maxScroll;
    syncFromViewport();
  }

  return (
    <Row gap={8} align="center" style={{ minWidth: 0, width: "100%" }}>
      <Button
        type="button"
        variant="secondary"
        disabled={!canScroll || scrollLeft <= 1}
        onClick={() => scrollByStep(-1)}
      >
        Rul til venstre
      </Button>
      <div
        id={BOARD_SCROLL_TRACK_ID}
        title="Træk for at scrolle boardet"
        onClick={onTrackClick}
        style={{
          flex: 1,
          minWidth: 0,
          height: 18,
          borderRadius: 9,
          background: theme.bg.chrome,
          border: `1px solid ${theme.stroke.tertiary}`,
          position: "relative",
          cursor: canScroll ? "pointer" : "default",
        }}
      >
        {canScroll ? (
          <div
            data-thumb="1"
            role="scrollbar"
            aria-label="Board scroll"
            aria-valuenow={Math.round(scrollLeft)}
            aria-valuemin={0}
            aria-valuemax={Math.round(maxScroll)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              startThumbDrag(event.clientX);
            }}
            style={{
              position: "absolute",
              top: 2,
              bottom: 2,
              left: `${thumbLeftPercent}%`,
              width: `${thumbWidthPercent}%`,
              borderRadius: 7,
              background: theme.fill.secondary,
              border: `1px solid ${theme.stroke.primary}`,
              cursor: "grab",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: "2px 4px",
              borderRadius: 7,
              background: theme.fill.tertiary,
            }}
          />
        )}
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={!canScroll || scrollLeft >= maxScroll - 1}
        onClick={() => scrollByStep(1)}
      >
        Rul til højre
      </Button>
    </Row>
  );
}

function BoardZoomControls({
  boardZoom,
  setBoardZoom,
}: {
  boardZoom: number;
  setBoardZoom: (action: number | ((prev: number) => number)) => void;
}) {
  const pct = Math.round(boardZoom * 100);
  const atDefault = boardZoom === BOARD_ZOOM_DEFAULT;

  function resetZoom() {
    setBoardZoom(BOARD_ZOOM_DEFAULT);
    scheduleBoardScrollMetricsRefresh();
  }

  return (
    <Row gap={6} align="center" data-board-no-pan>
      <Text size="small" tone="secondary">
        Zoom: {pct}% (Ctrl+scroll)
      </Text>
      <Button
        type="button"
        variant="ghost"
        disabled={atDefault}
        onClick={resetZoom}
        title="Nulstil zoom til 100%"
      >
        100%
      </Button>
    </Row>
  );
}

function InProgressActivityIndicator({
  theme,
  variant = "active",
  size = 10,
  label = "I gang",
}: {
  theme: ReturnType<typeof useHostTheme>;
  variant?: "active" | "agent";
  size?: number;
  label?: string;
}) {
  const color = variant === "agent" ? theme.diff.renamed : theme.diff.added;

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          animation: "stardesk-wb-pulse-ring 1.5s ease-out infinite",
        }}
      />
      <span
        style={{
          width: Math.max(4, size * 0.42),
          height: Math.max(4, size * 0.42),
          borderRadius: "50%",
          background: color,
          animation: "stardesk-wb-pulse-core 1.5s ease-in-out infinite",
        }}
      />
    </span>
  );
}

function inProgressCardChrome(
  theme: ReturnType<typeof useHostTheme>,
  needsAgentRerun: boolean,
): { border: string; background: string } {
  const accent = needsAgentRerun ? theme.diff.renamed : theme.diff.added;
  return {
    border: `2px solid ${accent}`,
    background: theme.fill.tertiary,
  };
}

function InProgressCardStatusRow({
  theme,
  task,
  onOpen,
}: {
  theme: ReturnType<typeof useHostTheme>;
  task: Task;
  onOpen: () => void;
}) {
  const needsAgentRerun = taskNeedsAgentRerun(task);
  const agentHint = getInProgressAgentHint(task);
  return (
    <Row
      gap={8}
      align="center"
      justify="space-between"
      wrap
      style={{
        marginTop: 2,
        paddingTop: 6,
        borderTop: `1px solid ${theme.stroke.tertiary}`,
      }}
    >
      <Row gap={6} align="center" style={{ flex: 1, minWidth: 0 }}>
        <InProgressActivityIndicator
          theme={theme}
          variant={needsAgentRerun ? "agent" : "active"}
          size={12}
          label={needsAgentRerun ? "I gang — agent genkører" : "I gang — agent forventes"}
        />
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text size="small" tone="secondary" style={{ lineHeight: 1.35 }}>
            {needsAgentRerun
              ? "Agent genkører — åbn sag"
              : "Agent bygger — afslut med leverance → Agent Review"}
          </Text>
          {agentHint ? (
            <Text size="small" tone="tertiary" style={{ lineHeight: 1.35 }}>
              {agentHint}
            </Text>
          ) : null}
        </Stack>
      </Row>
      <IconButton title="Åbn sag" size="sm" onClick={onOpen}>
        ↗
      </IconButton>
    </Row>
  );
}

function nearestSnapIndex(width: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < COLUMN_WIDTH_SNAPS.length; i += 1) {
    const candidate = COLUMN_WIDTH_SNAPS[i] ?? 300;
    const dist = Math.abs(candidate - width);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "manual", label: "Manuel" },
  { value: "number", label: "Nummer" },
  { value: "date", label: "Dato" },
  { value: "priority", label: "Prio" },
  { value: "title", label: "Titel" },
];

function sortModeLabel(mode: SortMode): string {
  return SORT_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

type PickerOption = { value: string; label: string };

const VERIFICATION_SCOPE_OPTIONS: PickerOption[] = [
  { value: "stardesk", label: "STARDESK (deployet app)" },
  { value: "cursor", label: "Cursor / Work Board (ses her)" },
];

function ThemedPicker({
  pickerId,
  openPickerId,
  setOpenPickerId,
  value,
  onChange,
  options,
  theme,
  style,
  panelMinWidth,
  panelMaxHeight = 280,
  disabled,
  compact = false,
}: {
  pickerId: string;
  openPickerId: string | null;
  setOpenPickerId: (id: string | null) => void;
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  theme: ReturnType<typeof useHostTheme>;
  style?: Record<string, string | number>;
  panelMinWidth?: number;
  panelMaxHeight?: number;
  disabled?: boolean;
  compact?: boolean;
}) {
  const isOpen = openPickerId === pickerId;
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <Stack gap={0} style={{ position: "relative", flexShrink: 0, ...style }}>
      <Button
        variant={compact ? "ghost" : "secondary"}
        disabled={disabled}
        onClick={() => setOpenPickerId(isOpen ? null : pickerId)}
        style={
          compact
            ? {
                padding: "4px 10px",
                minWidth: 0,
                fontSize: 12,
                textAlign: "left",
                maxWidth: 280,
              }
            : { width: "100%", textAlign: "left" }
        }
      >
        {selectedLabel}
      </Button>
      {isOpen ? (
        <Stack
          gap={2}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 320,
            minWidth: panelMinWidth ?? 136,
            maxHeight: panelMaxHeight,
            overflowY: "auto",
            backgroundColor: theme.bg.elevated,
            border: `1px solid ${theme.stroke.primary}`,
            borderRadius: 8,
            padding: 4,
          }}
        >
          {options.map((option) => (
            <Button
              key={option.value}
              variant={value === option.value ? "primary" : "ghost"}
              onClick={() => {
                onChange(option.value);
                setOpenPickerId(null);
              }}
            >
              {option.label}
            </Button>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

function ColumnSortMenu({
  column,
  sortMode,
  openSortColumn,
  setOpenSortColumn,
  onChange,
  theme,
  variant = "label",
}: {
  column: Status;
  sortMode: SortMode;
  openSortColumn: Status | null;
  setOpenSortColumn: (column: Status | null) => void;
  onChange: (mode: SortMode) => void;
  theme: ReturnType<typeof useHostTheme>;
  variant?: "label" | "icon";
}) {
  const isOpen = openSortColumn === column;
  const label = sortModeLabel(sortMode);
  return (
    <Stack gap={0} style={{ position: "relative", flexShrink: 0 }}>
      <Button
        variant="secondary"
        title={variant === "icon" ? `Sorter: ${label}` : undefined}
        onClick={() => setOpenSortColumn(isOpen ? null : column)}
        style={{
          padding: variant === "icon" ? "2px 5px" : "2px 6px",
          minWidth: 0,
          fontSize: 11,
        }}
      >
        {variant === "icon" ? "⇅" : label}
      </Button>
      {isOpen ? (
        <Stack
          gap={2}
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            zIndex: 220,
            minWidth: 136,
            backgroundColor: theme.bg.elevated,
            border: `1px solid ${theme.stroke.primary}`,
            borderRadius: 8,
            padding: 4,
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={sortMode === option.value ? "primary" : "ghost"}
              onClick={() => {
                onChange(option.value);
                setOpenSortColumn(null);
              }}
            >
              {option.label}
            </Button>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

function defaultColumnHeaderLabel(column: Status, width: number): string {
  return width <= 280 ? COLUMN_SHORT_LABELS[column] : COLUMN_LABELS[column];
}

function columnHeaderLabel(
  column: Status,
  width: number,
  customLabels: ColumnLabelOverrides,
): string {
  const custom = customLabels[column]?.trim();
  if (custom) return custom;
  return defaultColumnHeaderLabel(column, width);
}

function columnHeaderTooltip(column: Status, customLabels: ColumnLabelOverrides): string {
  const custom = customLabels[column]?.trim();
  return custom || COLUMN_LABELS[column];
}

function ColumnHeaderTitle({
  column,
  width,
  customLabels,
  setCustomLabels,
  showToast,
  onExpand,
  layout,
}: {
  column: Status;
  width: number;
  customLabels: ColumnLabelOverrides;
  setCustomLabels: (
    updater: (prev: ColumnLabelOverrides) => ColumnLabelOverrides,
  ) => void;
  showToast: (message: string) => void;
  onExpand?: () => void;
  layout: "compact" | "stacked" | "inline";
}) {
  const [editingColumn, setEditingColumn] = useCanvasState<Status | null>(
    "stardesk-column-label-edit-v1",
    null,
  );
  const [editDraft, setEditDraft] = useCanvasState<string>(
    "stardesk-column-label-edit-draft-v1",
    "",
  );

  const isEditing = editingColumn === column;
  const label = columnHeaderLabel(column, width, customLabels);
  const tooltip = columnHeaderTooltip(column, customLabels);
  const renameHint = " (dobbeltklik for at omdøbe)";

  function startEdit(event?: { preventDefault: () => void; stopPropagation: () => void }) {
    event?.preventDefault();
    event?.stopPropagation();
    setEditingColumn(column);
    setEditDraft(customLabels[column] ?? defaultColumnHeaderLabel(column, width));
  }

  function cancelEdit() {
    setEditingColumn(null);
    setEditDraft("");
  }

  function saveEdit() {
    const trimmed = editDraft.trim();
    setCustomLabels((prev) => {
      const next = { ...prev };
      if (!trimmed) {
        delete next[column];
      } else {
        next[column] = trimmed;
      }
      return next;
    });
    setEditingColumn(null);
    setEditDraft("");
    showToast(trimmed ? "Kolonnenavn gemt" : "Kolonnenavn nulstillet");
  }

  if (isEditing) {
    return (
      <div
        onKeyDownCapture={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveEdit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelEdit();
          }
        }}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          saveEdit();
        }}
        style={{ minWidth: 0, width: "100%" }}
      >
        <TextInput
          value={editDraft}
          onChange={setEditDraft}
          placeholder="Rediger kolonnenavn"
          style={{
            fontSize: layout === "compact" ? 12 : 13,
            fontWeight: 600,
            width: "100%",
          }}
        />
      </div>
    );
  }

  if (layout === "compact") {
    return (
      <div
        role="button"
        tabIndex={0}
        title={`${tooltip} · Klik for at udvide${renameHint}`}
        onClick={onExpand}
        onDoubleClick={(event) => startEdit(event)}
        style={{
          cursor: "pointer",
          wordBreak: "break-word",
          lineHeight: 1.25,
          fontSize: 12,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {label}
      </div>
    );
  }

  if (layout === "stacked") {
    return (
      <div
        role="button"
        tabIndex={0}
        title={`${tooltip}${renameHint}`}
        onDoubleClick={(event) => startEdit(event)}
        style={{ cursor: "text", minWidth: 0 }}
      >
        <Text
          weight="semibold"
          style={{
            lineHeight: 1.25,
            wordBreak: "break-word",
          }}
        >
          {label}
        </Text>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title={`${tooltip}${renameHint}`}
      onDoubleClick={(event) => startEdit(event)}
      style={{
        cursor: "text",
        flex: "1 1 0",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <Text weight="semibold" truncate>
        {label}
      </Text>
    </div>
  );
}

function ColumnHeader({
  column,
  width,
  columnTaskCount,
  sortMode,
  openSortColumn,
  setOpenSortColumn,
  onSortChange,
  theme,
  onExpand,
  customLabels,
  setCustomLabels,
  showToast,
}: {
  column: Status;
  width: number;
  columnTaskCount: number;
  sortMode: SortMode;
  openSortColumn: Status | null;
  setOpenSortColumn: (column: Status | null) => void;
  onSortChange: (mode: SortMode) => void;
  theme: ReturnType<typeof useHostTheme>;
  onExpand: () => void;
  customLabels: ColumnLabelOverrides;
  setCustomLabels: (
    updater: (prev: ColumnLabelOverrides) => ColumnLabelOverrides,
  ) => void;
  showToast: (message: string) => void;
}) {
  const isCompact = width <= COMPACT_MAX_WIDTH;
  const useStackedHeader = width <= COLUMN_HEADER_STACK_WIDTH;

  if (isCompact) {
    return (
      <CardHeader
        style={{ paddingRight: 16 }}
        trailing={
          <Text size="small" tone="secondary">
            {columnTaskCount}
          </Text>
        }
      >
        <ColumnHeaderTitle
          column={column}
          width={width}
          customLabels={customLabels}
          setCustomLabels={setCustomLabels}
          showToast={showToast}
          onExpand={onExpand}
          layout="compact"
        />
      </CardHeader>
    );
  }

  const sortMenu = (
    <ColumnSortMenu
      column={column}
      sortMode={sortMode}
      openSortColumn={openSortColumn}
      setOpenSortColumn={setOpenSortColumn}
      theme={theme}
      variant={useStackedHeader ? "icon" : "label"}
      onChange={onSortChange}
    />
  );

  const headerBorder = {
    borderBottom: `1px solid ${theme.stroke.tertiary}`,
    minWidth: 0,
  };

  if (useStackedHeader) {
    return (
      <Stack
        gap={4}
        style={{
          ...headerBorder,
          padding: "8px 18px 8px 12px",
        }}
      >
        <ColumnHeaderTitle
          column={column}
          width={width}
          customLabels={customLabels}
          setCustomLabels={setCustomLabels}
          showToast={showToast}
          layout="stacked"
        />
        <Row gap={4} align="center" justify="space-between">
          <Text size="small" tone="secondary">
            {columnTaskCount}
          </Text>
          {sortMenu}
        </Row>
      </Stack>
    );
  }

  return (
    <Row
      gap={6}
      align="center"
      style={{
        ...headerBorder,
        padding: "10px 18px 10px 12px",
        flexWrap: "nowrap",
      }}
    >
      <ColumnHeaderTitle
        column={column}
        width={width}
        customLabels={customLabels}
        setCustomLabels={setCustomLabels}
        showToast={showToast}
        layout="inline"
      />
      <Row gap={4} align="center" style={{ flexShrink: 0 }}>
        <Text size="small" tone="secondary">
          {columnTaskCount}
        </Text>
        {sortMenu}
      </Row>
    </Row>
  );
}

export default function StardeskWorkboardCanvas() {
  const theme = useHostTheme();
  const dispatchCanvasAction = useCanvasAction();
  const [tasks, setTasksRaw] = useCanvasState<Task[]>("stardesk-tasks-v1", seedTasks);
  const setTasks = createWorkboardTasksSetter(setTasksRaw);
  const [draggingId, setDraggingId] = useCanvasState<string | null>("stardesk-dragging-id-v1", null);
  const [selectedId, setSelectedId] = useCanvasState<string | null>(
    "stardesk-selected-id-v1",
    seedTasks[0]?.id ?? null,
  );
  const [detailOpenId, setDetailOpenId] = useCanvasState<string | null>(
    "stardesk-detail-open-id-v1",
    null,
  );
  const [columnWidths, setColumnWidths] = useCanvasState<Record<string, number>>(
    "stardesk-column-widths-v1",
    {},
  );
  const [resizing, setResizing] = useCanvasState<ResizingState>("stardesk-resizing-v1", null);
  const [lastClick, setLastClick] = useCanvasState<{ id: string; time: number } | null>(
    "stardesk-last-click-v1",
    null,
  );
  const [dragOverTaskId, setDragOverTaskId] = useCanvasState<string | null>(
    "stardesk-drag-over-task-id-v1",
    null,
  );
  const [closeConfirmId, setCloseConfirmId] = useCanvasState<string | null>(
    "stardesk-close-confirm-id-v1",
    null,
  );
  const [columnSorts, setColumnSorts] = useCanvasState<Record<string, SortMode>>(
    "stardesk-column-sorts-v1",
    {},
  );
  const [newTaskDraft, setNewTaskDraft] = useCanvasState<NewTaskDraft | null>(
    "stardesk-new-task-draft-v1",
    null,
  );
  const [hoveredTaskId, setHoveredTaskId] = useCanvasState<string | null>(
    "stardesk-hovered-task-id-v1",
    null,
  );
  const [toast, setToast] = useCanvasState<ToastState | null>("stardesk-toast-v1", null);
  const [openSortColumn, setOpenSortColumn] = useCanvasState<Status | null>(
    "stardesk-open-sort-column-v1",
    null,
  );
  const [childrenPanelParentId, setChildrenPanelParentId] = useCanvasState<string | null>(
    "stardesk-children-panel-parent-v1",
    null,
  );
  const [reviewRejectId, setReviewRejectId] = useCanvasState<string | null>(
    "stardesk-review-reject-id-v1",
    null,
  );
  const [reviewRejectReason, setReviewRejectReason] = useCanvasState<string>(
    "stardesk-review-reject-reason-v1",
    "",
  );
  const [reviewRejectAttachments, setReviewRejectAttachments] = useCanvasState<
    ReviewRejectAttachment[]
  >("stardesk-review-reject-attachments-v1", []);
  const [detailDescriptionEditOpen, setDetailDescriptionEditOpen] = useCanvasState<boolean>(
    "stardesk-detail-description-edit-v1",
    false,
  );
  const [descriptionEditBaselines, setDescriptionEditBaselines] = useCanvasState<
    Record<string, string>
  >("stardesk-description-edit-baselines-v1", {});
  const [openPickerId, setOpenPickerId] = useCanvasState<string | null>(
    "stardesk-open-picker-v1",
    null,
  );
  const [agentRerunFeedback, setAgentRerunFeedback] = useCanvasState<{
    taskId: string;
    message: string;
  } | null>("stardesk-agent-rerun-feedback-v1", null);
  const [agentReviewFeedback, setAgentReviewFeedback] = useCanvasState<{
    taskId: string;
    message: string;
  } | null>("stardesk-agent-review-feedback-v1", null);
  const [playwrightCopyFeedback, setPlaywrightCopyFeedback] = useCanvasState<{
    taskId: string;
    message: string;
  } | null>("stardesk-playwright-copy-feedback-v1", null);
  const [reviewPrepDrafts, setReviewPrepDrafts] = useCanvasState<
    Record<string, ReviewPrepDraft>
  >("stardesk-review-prep-drafts-v1", {});
  const [reviewDeliveryDrafts, setReviewDeliveryDrafts] = useCanvasState<
    Record<string, ReviewDeliveryDraft>
  >("stardesk-review-delivery-drafts-v1", {});
  const [agentPlanDrafts, setAgentPlanDrafts] = useCanvasState<Record<string, string>>(
    "stardesk-agent-plan-drafts-v1",
    {},
  );
  const [agentReviewViewDrafts, setAgentReviewViewDrafts] = useCanvasState<Record<string, string>>(
    "stardesk-agent-review-view-drafts-v1",
    {},
  );
  const [autoSaveStatusByTask, setAutoSaveStatusByTask] = useCanvasState<
    Record<string, Partial<Record<AutoSaveKind, AutoSaveStatus>>>
  >("stardesk-auto-save-status-v1", {});
  const autoSaveFlashTimersRef = { current: new Map<string, ReturnType<typeof setTimeout>>() };
  const [detailPanelHeights, setDetailPanelHeights] = useCanvasState<DetailPanelHeightsState>(
    "stardesk-detail-panel-heights-v1",
    "auto",
  );
  const [detailPanelResizing, setDetailPanelResizing] = useCanvasState<DetailPanelResizingState>(
    "stardesk-detail-panel-resizing-v1",
    null,
  );
  const [pipelineAgentFeedback, setPipelineAgentFeedback] = useCanvasState<{
    taskId: string;
    message: string;
  } | null>("stardesk-pipeline-agent-feedback-v1", null);
  const [reviewPrepFeedback, setReviewPrepFeedback] = useCanvasState<{
    taskId: string;
    message: string;
  } | null>("stardesk-review-prep-feedback-v1", null);
  const [columnLabels, setColumnLabels] = useCanvasState<ColumnLabelOverrides>(
    "stardesk-column-labels-v1",
    {},
  );
  const [boardScrollLeft, setBoardScrollLeft] = useCanvasState<number>(
    "stardesk-board-scroll-left-v1",
    0,
  );
  const [boardScrollMetrics, setBoardScrollMetrics] = useCanvasState<BoardScrollMetrics>(
    "stardesk-board-scroll-metrics-v1",
    { scrollWidth: 0, clientWidth: 0 },
  );
  const [boardZoom, setBoardZoom] = useCanvasState<number>(
    "stardesk-board-zoom-v1",
    BOARD_ZOOM_DEFAULT,
  );
  const [dbSyncApiUrl, setDbSyncApiUrl] = useCanvasState<string>(
    "stardesk-db-sync-api-url-v1",
    WORKBOARD_DEFAULT_API_URL,
  );
  const [dbSyncApiToken, setDbSyncApiToken] = useCanvasState<string>(
    "stardesk-db-sync-api-token-v1",
    "",
  );
  const [dbSyncStatus, setDbSyncStatus] = useCanvasState<DbSyncStatus>(
    "stardesk-db-sync-status-v1",
    { state: "idle" },
  );
  const [dbSyncSettingsOpen, setDbSyncSettingsOpen] = useCanvasState<boolean>(
    "stardesk-db-sync-settings-open-v1",
    false,
  );
  const [dbAutosaveEnabled, setDbAutosaveEnabled] = useCanvasState<boolean>(
    "stardesk-db-autosave-enabled-v1",
    true,
  );
  const [localSaveStatus, setLocalSaveStatus] = useCanvasState<LocalSaveStatus>(
    "stardesk-local-save-status-v1",
    {},
  );

  boardZoomApply = setBoardZoom;

  function updateBoardScrollMetrics(el: HTMLDivElement) {
    applyBoardScrollMetricsUpdate(setBoardScrollMetrics, el);
  }

  function handleBoardViewportScroll(event: { currentTarget: HTMLDivElement }) {
    scheduleBoardScrollSync(event.currentTarget, setBoardScrollLeft, setBoardScrollMetrics);
  }

  function handleBoardPanStart(event: {
    button: number;
    clientX: number;
    target: EventTarget | null;
    currentTarget: HTMLDivElement;
    preventDefault: () => void;
  }) {
    if (event.button !== 0) return;
    if (draggingId) return;
    if (!isBoardPanTarget(event.target)) return;
    const el = event.currentTarget;
    event.preventDefault();
    const startX = event.clientX;
    const startScroll = el.scrollLeft;

    function onMove(ev: MouseEvent) {
      el.scrollLeft = startScroll - (ev.clientX - startX);
    }

    function onUp() {
      globalThis.removeEventListener?.("mousemove", onMove);
      globalThis.removeEventListener?.("mouseup", onUp);
      setBoardScrollLeft((prev) => {
        const next = el.scrollLeft;
        return prev === next ? prev : next;
      });
      updateBoardScrollMetrics(el);
    }

    globalThis.addEventListener?.("mousemove", onMove);
    globalThis.addEventListener?.("mouseup", onUp);
  }

  workboardTasksSnapshot = tasks;
  const hydratedTasks = hydrateTasksCore(tasks);
  const childrenPanelParent = childrenPanelParentId
    ? hydratedTasks.find((task) => task.id === childrenPanelParentId) ?? null
    : null;
  const childrenPanelTasks = childrenPanelParentId
    ? getChildTasks(hydratedTasks, childrenPanelParentId)
    : [];
  const rootTasks = hydratedTasks.filter((task) => !task.parentId);

  function showToast(message: string, undo: ToastUndo | null = null) {
    setToast({ message, undo });
    globalThis.setTimeout?.(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 8000);
  }

  async function saveWorkboardToDb(trigger: "manual" | "auto" = "manual") {
    if (dbSyncInFlight) {
      if (trigger === "manual") showToast("Gemmer allerede…");
      return;
    }
    const token = dbSyncApiToken.trim();
    const apiUrl = (dbSyncApiUrl.trim() || WORKBOARD_DEFAULT_API_URL).replace(/\/$/, "");
    if (!token) {
      setDbSyncSettingsOpen(true);
      showToast(
        "Manglende API-token — indtast staff JWT under «Database-sync» (login på STARDESK API).",
      );
      return;
    }
    dbSyncInFlight = true;
    setDbSyncStatus({ state: "saving", at: Date.now() });
    if (trigger === "manual") showToast("Gemmer…");
    try {
      const currentTasks = tasksForDbPersist(workboardTasksSnapshot);
      const result = await bulkImportWorkboardTasks(currentTasks, apiUrl, token);
      const updated = result.updated ?? 0;
      const created = result.created ?? 0;
      const summary = `Gemt til database (${updated} opdateret${created ? `, ${created} nye` : ""}).`;
      setDbSyncStatus({
        state: "ok",
        at: Date.now(),
        message: summary,
        created,
        updated,
      });
      if (trigger === "manual") {
        showToast("Gemt til database");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : describeDbSyncFetchError(err);
      setDbSyncStatus({ state: "error", at: Date.now(), message });
      showToast(
        trigger === "auto"
          ? `Auto-gem fejlede: ${message.slice(0, 160)}`
          : `Kunne ikke gemme: ${message.slice(0, 200)}`,
      );
    } finally {
      dbSyncInFlight = false;
    }
  }

  dbAutosaveEnabledSnapshot = dbAutosaveEnabled;
  dbSyncApiTokenSnapshot = dbSyncApiToken;
  dbSaveTrigger = saveWorkboardToDb;
  scheduleWorkboardDbAutosave();

  function collectAllWorkboardTaskIds(taskList: Task[]): Set<string> {
    const ids = new Set<string>();
    for (const task of taskList) ids.add(task.id);
    for (const id of Object.keys(reviewDeliveryDrafts)) ids.add(id);
    for (const id of Object.keys(reviewPrepDrafts)) ids.add(id);
    for (const id of Object.keys(agentPlanDrafts)) ids.add(id);
    for (const id of Object.keys(agentReviewViewDrafts)) ids.add(id);
    return ids;
  }

  function saveWorkboardLocally() {
    if (detailOpenId && detailDescriptionEditOpen) {
      commitDescriptionFieldHistory(detailOpenId, "Beskrivelse gemt ved lokal gem");
      setDetailDescriptionEditOpen(false);
    }

    const hydrated = hydrateTasksCore(workboardTasksSnapshot);
    const ids = collectAllWorkboardTaskIds(hydrated);
    const taskById = new Map(hydrated.map((task) => [task.id, task]));

    for (const taskId of ids) {
      flushAllTaskAutoSaves(taskId);
    }

    for (const taskId of ids) {
      const base = taskById.get(taskId);
      if (!base) continue;
      pendingDeliveryDrafts.set(taskId, getReviewDeliveryDraftForTask(base));
      pendingReviewPrepDrafts.set(taskId, getReviewPrepDraftForTask(base));
      pendingAgentPlanDrafts.set(taskId, getAgentPlanDraftForTask(base));
      pendingAgentReviewViewDrafts.set(taskId, getAgentReviewViewDraftForTask(base));
    }

    setTasks((prev) => {
      const merged = prev.map((task) => {
        const withDrafts = getTaskWithPendingDrafts(task);
        clearPendingDraftsForTask(task.id);
        return withDrafts;
      });
      return assignBoardIndices(merged);
    });

    setReviewDeliveryDrafts({});
    setReviewPrepDrafts({});
    setAgentPlanDrafts({});
    setAgentReviewViewDrafts({});

    const at = Date.now();
    setLocalSaveStatus({ at });
    showToast(`Gemt lokalt kl. ${formatDaTimeShort(at)}`);
  }

  function runUndo(undo: ToastUndo) {
    if (undo.kind === "restoreDeleted") {
      setTasks((prev) => [...hydrateTasksCore(prev), undo.task]);
    } else if (undo.kind === "restoreStatus") {
      setTasks((prev) =>
        hydrateTasksCore(prev).map((task) =>
          task.id === undo.taskId ? { ...task, status: undo.status } : task,
        ),
      );
    } else if (undo.kind === "removeCreated") {
      setTasks((prev) => hydrateTasksCore(prev).filter((task) => task.id !== undo.taskId));
      if (selectedId === undo.taskId) setSelectedId(null);
      if (detailOpenId === undo.taskId) setDetailOpenId(null);
    }
    setToast(null);
  }
  const detailTask = hydratedTasks.find((task) => task.id === detailOpenId) ?? null;

  function openTask(taskId: string) {
    setSelectedId(taskId);
    setDetailOpenId(taskId);
    setDetailPanelHeights("auto");
  }

  function handleCardActivate(taskId: string) {
    const now = Date.now();
    if (lastClick?.id === taskId && now - lastClick.time < 450) {
      openTask(taskId);
      setLastClick(null);
      return;
    }
    setLastClick({ id: taskId, time: now });
    setSelectedId(taskId);
    const childCount = getChildTasks(hydratedTasks, taskId).length;
    if (childCount > 0) {
      setChildrenPanelParentId(taskId);
    } else {
      setChildrenPanelParentId(null);
    }
  }

  function dismissEphemeralPanels() {
    setOpenSortColumn(null);
    setChildrenPanelParentId(null);
    setOpenPickerId(null);
  }

  scheduleAutoArchiveChecks(setTasks, (count) => {
    showToast(
      count === 1
        ? "1 opgave automatisk flyttet til Lukkede opgaver (1 time i Done)"
        : `${count} opgaver automatisk flyttet til Lukkede opgaver (1 time i Done)`,
    );
  });

  function moveTask(taskId: string, targetStatus: Status, beforeTaskId?: string) {
    flushAutoSaveTimer("delivery", taskId);
    flushAutoSaveTimer("prep", taskId);
    flushAutoSaveTimer("plan", taskId);
    const draggingTask = hydratedTasks.find((task) => task.id === taskId);
    if (!draggingTask) return;
    const effectiveTask = getTaskWithPendingDrafts(draggingTask);
    const gate = validateWorkboardStatusChange(effectiveTask, targetStatus);
    if (!gate.allowed) {
      showToast(gate.message);
      return;
    }

    let agentStartTask: Task | null = null;
    let agentReviewStartTask: Task | null = null;
    let refinementStartTask: Task | null = null;
    let readyStartTask: Task | null = null;
    setTasks((prev) => {
      const current = hydrateTasksCore(prev);
      const source = current.find((task) => task.id === taskId);
      if (!source) return current;

      const remaining = current.filter((task) => task.id !== taskId);
      const statusChanged = source.status !== targetStatus;
      let movedBase = applyPendingDraftsInline(source);
      if (statusChanged) {
        clearPendingDraftsForTask(taskId);
      }
      movedBase = applyStatusToTask(movedBase, targetStatus);
      if (statusChanged && targetStatus === "Review") {
        movedBase = applyReviewTransitionEvidence(movedBase);
      }
      const movedTask = statusChanged
        ? appendWorkflowTransitionActivity(
            { ...movedBase, status: targetStatus },
            source.status,
            targetStatus,
            "user",
          )
        : appendTaskActivity(
            { ...movedBase, status: targetStatus },
            "user",
            `Omrokeret i ${COLUMN_LABELS[targetStatus]}`,
          );

      if (statusChanged && targetStatus === "In Progress") {
        agentStartTask = movedTask;
      }
      if (statusChanged && targetStatus === "Review") {
        agentReviewStartTask = movedTask;
      }
      if (statusChanged && targetStatus === "Refinement") {
        refinementStartTask = movedTask;
      }
      if (statusChanged && targetStatus === "Ready") {
        readyStartTask = movedTask;
      }

      if (beforeTaskId) {
        const beforeIndex = remaining.findIndex((task) => task.id === beforeTaskId);
        if (beforeIndex >= 0) {
          return [
            ...remaining.slice(0, beforeIndex),
            movedTask,
            ...remaining.slice(beforeIndex),
          ];
        }
      }

      return insertTaskAtColumnTop(remaining, movedTask, targetStatus);
    });
    setReviewDeliveryDrafts((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setReviewPrepDrafts((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setAgentPlanDrafts((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    if (agentStartTask) {
      void startInProgressAgent(agentStartTask);
    }
    if (agentReviewStartTask) {
      void startAgentReviewAgent(agentReviewStartTask);
    }
    if (refinementStartTask) {
      void startPipelineAgent(refinementStartTask, "refinement");
    }
    if (readyStartTask) {
      void startPipelineAgent(readyStartTask, "ready");
    }
  }

  function moveTaskByOffset(taskId: string, offset: -1 | 1) {
    setTasks((prev) => {
      const current = hydrateTasksCore(prev);
      const index = current.findIndex((task) => task.id === taskId);
      if (index < 0) return current;
      const task = current[index];
      if (!task) return current;
      const sameColumnIndexes = current
        .map((entry, i) => (entry.status === task.status ? i : -1))
        .filter((i) => i >= 0);
      const pos = sameColumnIndexes.indexOf(index);
      if (pos < 0) return current;
      const targetPos = pos + offset;
      if (targetPos < 0 || targetPos >= sameColumnIndexes.length) return current;
      const swapIndex = sameColumnIndexes[targetPos];
      if (swapIndex == null) return current;
      const next = [...current];
      const tmp = next[index];
      next[index] = next[swapIndex] as Task;
      next[swapIndex] = tmp as Task;
      return assignBoardIndices(next);
    });
  }

  function deleteTask(taskId: string) {
    const removed = hydratedTasks.find((task) => task.id === taskId);
    if (!removed) return;
    setTasks((prev) =>
      hydrateTasksCore(prev)
        .filter((task) => task.id !== taskId)
        .map((task) => (task.parentId === taskId ? { ...task, parentId: undefined } : task)),
    );
    if (selectedId === taskId) setSelectedId(null);
    if (detailOpenId === taskId) setDetailOpenId(null);
    if (childrenPanelParentId === taskId) setChildrenPanelParentId(null);
    setCloseConfirmId(null);
    showToast(`"${removed.title}" slettet`, { kind: "restoreDeleted", task: removed });
  }

  function closeTask(taskId: string) {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task) return;
    const previousStatus = task.status;
    moveTask(taskId, "Archived");
    setCloseConfirmId(null);
    if (detailOpenId === taskId) setDetailOpenId(null);
    setSelectedId(taskId);
    showToast(`"${task.title}" lukket`, {
      kind: "restoreStatus",
      taskId,
      status: previousStatus,
    });
  }

  function requestInProgress(taskId: string) {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task || !REQUEST_IN_PROGRESS_FROM.includes(task.status)) return;
    if (!hasReadyToImplement(task)) {
      showToast(READY_TO_IN_PROGRESS_MESSAGE);
      return;
    }
    const previousStatus = task.status;
    moveTask(taskId, "In Progress");
    showToast(`"${task.title}" → I gang`, {
      kind: "restoreStatus",
      taskId,
      status: previousStatus,
    });
  }

  function requestStartWorkflow(taskId: string) {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task || !isPipelineStartStatus(task.status)) return;
    if (!hasKodeklarSpec(task)) {
      void startPipelineAgent(task, "kodeklar");
      return;
    }
    moveTask(taskId, "Refinement");
  }

  async function startPipelineAgent(task: Task, kind: PipelineAgentKind) {
    const promptBuilders: Record<PipelineAgentKind, (t: Task) => string> = {
      kodeklar: buildKodeklarAgentPrompt,
      refinement: buildRefinementAgentPrompt,
      ready: buildReadyToInProgressPrompt,
    };
    const actionLabels: Record<PipelineAgentKind, string> = {
      kodeklar: "Kodeklar-agent startet",
      refinement: "Refinement-agent startet",
      ready: "Ready-agent startet",
    };
    const toastLabels: Record<PipelineAgentKind, string> = {
      kodeklar: "Kodeklar-agent",
      refinement: "Plan-agent",
      ready: "Ready-agent",
    };
    const timestampFields: Record<PipelineAgentKind, keyof Task> = {
      kodeklar: "kodeklarAgentStartedAt",
      refinement: "refinementAgentStartedAt",
      ready: "readyAgentStartedAt",
    };

    const prompt = promptBuilders[kind](task);
    const copied = await copyTextToClipboard(prompt);
    dispatchCanvasAction({
      type: "newComposerChat",
      userPrompt: prompt,
    });
    const label = toastLabels[kind];
    const message = copied
      ? `${label} startet for #${formatTaskNumber(task)} — prompt også kopieret til udklipsholder.`
      : `${label}-chat åbnet for #${formatTaskNumber(task)}. Kunne ikke kopiere prompt — brug spec i sagen hvis chatten er tom.`;
    setPipelineAgentFeedback({ taskId: task.id, message });
    const tsField = timestampFields[kind];
    const at = Date.now();
    setTasks((prev) =>
      hydrateTasksCore(prev).map((entry) =>
        entry.id === task.id
          ? appendTaskActivity(
              { ...entry, [tsField]: at },
              "agent",
              actionLabels[kind],
            )
          : entry,
      ),
    );
    showToast(message);
  }

  async function startInProgressAgent(task: Task) {
    const isRerun = taskNeedsAgentRerun(task);
    const prompt = isRerun
      ? buildAgentRerunPrompt(task, getAgentRerunReason(task))
      : buildInProgressWorkPrompt(task);
    const copied = await copyTextToClipboard(prompt);
    dispatchCanvasAction({
      type: "newComposerChat",
      userPrompt: prompt,
    });
    const message = copied
      ? `Agent startet for #${formatTaskNumber(task)} — prompt også kopieret til udklipsholder.`
      : `Agent-chat åbnet for #${formatTaskNumber(task)}. Kunne ikke kopiere prompt — brug spec i sagen hvis chatten er tom.`;
    setAgentRerunFeedback({ taskId: task.id, message });
    setTasks((prev) =>
      hydrateTasksCore(prev).map((entry) =>
        entry.id === task.id
          ? appendTaskActivity(
              entry,
              "user",
              isRerun ? "Genkørsels-agent startet" : "Implementerings-agent startet",
            )
          : entry,
      ),
    );
    showToast(message);
  }

  async function startAgentReviewAgent(task: Task) {
    const prompt = buildAgentReviewPrompt(task);
    const copied = await copyTextToClipboard(prompt);
    dispatchCanvasAction({
      type: "newComposerChat",
      userPrompt: prompt,
    });
    const message = copied
      ? `Agent Review startet for #${formatTaskNumber(task)} — prompt også kopieret.`
      : `Agent Review-chat åbnet for #${formatTaskNumber(task)}. Kunne ikke kopiere prompt.`;
    setAgentReviewFeedback({ taskId: task.id, message });
    setTasks((prev) =>
      hydrateTasksCore(prev).map((entry) =>
        entry.id === task.id
          ? appendTaskActivity(
              {
                ...entry,
                agentReviewAgentStartedAt: Date.now(),
                agentReviewEvidence: entry.agentReviewEvidence
                  ? { ...entry.agentReviewEvidence, status: "running" }
                  : {
                      at: Date.now(),
                      actor: "agent",
                      status: "running",
                      method: resolveAgentReviewMethod(getReviewVerificationScope(entry)),
                      summary: "Agent Review-agent kører…",
                    },
              },
              "agent",
              "Agent Review-agent startet",
            )
          : entry,
      ),
    );
    showToast(message);
  }

  async function runAgentRerunForTask(task: Task) {
    return startInProgressAgent(task);
  }

  async function copyPlaywrightPipelineCommand(task: Task) {
    const command = buildPlaywrightPipelineCommand(task);
    const copied = await copyTextToClipboard(command);
    const message = copied
      ? "Pipeline-kommando kopieret — brug GitHub Actions hvis du ikke kører lokalt."
      : "Kunne ikke kopiere — se STARDESK/docs/review-playwright-agent.md.";
    setPlaywrightCopyFeedback({ taskId: task.id, message });
    showToast(message);
  }

  function getReviewPrepDraftForTask(task: Task): ReviewPrepDraft {
    const draft = reviewPrepDrafts[task.id];
    const prep = getReviewPrep(task);
    return {
      heading: draft?.heading ?? prep.heading,
      summary: draft?.summary ?? prep.summary ?? "",
    };
  }

  function getReviewDeliveryDraftForTask(task: Task): ReviewDeliveryDraft {
    const draft = reviewDeliveryDrafts[task.id];
    const stored = getReviewDelivery(task);
    const scope = draft?.verificationScope ?? stored.verificationScope;
    return {
      heading: draft?.heading ?? stored.heading,
      summary: draft?.summary ?? stored.summary ?? "",
      verificationUrl: draft?.verificationUrl ?? stored.verificationUrl ?? "",
      verificationLabel: draft?.verificationLabel ?? stored.verificationLabel ?? "",
      verificationScope: scope,
    };
  }

  function getAgentReviewViewDraftForTask(task: Task): string {
    const draft = agentReviewViewDrafts[task.id];
    if (draft != null) return draft;
    return task.agentReviewView ?? "";
  }

  function getAgentPlanDraftForTask(task: Task): string {
    const draft = agentPlanDrafts[task.id];
    if (draft != null) return draft;
    return task.agentPlan ?? "";
  }

  function persistAgentPlanDraft(taskId: string) {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task) return;
    const plan = getAgentPlanDraftForTask(task).trim();
    if (!hasAgentPlanReady(task, plan)) {
      showToast(AGENT_PLAN_REQUIRED_MESSAGE);
      return;
    }
    flushAutoSaveTimer("plan", taskId);
    pendingAgentPlanDrafts.delete(taskId);
    commitAgentPlanDraft(taskId, plan);
  }

  function startDetailPanelResize(edge: DetailPanelEdge, startY: number) {
    const fixedHeights: DetailPanelHeightsFixed = isDetailPanelAutoMode(detailPanelHeights)
      ? { ...DEFAULT_DETAIL_PANEL_HEIGHTS }
      : { ...(detailPanelHeights as DetailPanelHeightsFixed) };

    if (isDetailPanelAutoMode(detailPanelHeights)) {
      setDetailPanelHeights(fixedHeights);
    }

    const startHeights = { ...fixedHeights };
    const onMove = (event: MouseEvent) => {
      const delta = event.clientY - startY;
      if (edge === "description-plan") {
        setDetailPanelHeights({
          description: clampDetailPanelHeight(startHeights.description + delta),
          plan: clampDetailPanelHeight(startHeights.plan - delta),
          review: startHeights.review,
        });
      } else {
        setDetailPanelHeights({
          description: startHeights.description,
          plan: clampDetailPanelHeight(startHeights.plan + delta),
          review: clampDetailPanelHeight(startHeights.review - delta),
        });
      }
    };
    const onUp = () => {
      globalThis.removeEventListener?.("mousemove", onMove);
      globalThis.removeEventListener?.("mouseup", onUp);
      setDetailPanelResizing(null);
    };
    setDetailPanelResizing({ edge, startY, startHeights });
    globalThis.addEventListener?.("mousemove", onMove);
    globalThis.addEventListener?.("mouseup", onUp);
  }

  function commitDescriptionFieldHistory(taskId: string, activityAction = "Beskrivelse gemt") {
    let saved = false;
    let savedDescription: string | null = null;
    setTasks((prev) =>
      prev.map((entry) => {
        if (entry.id !== taskId) return entry;
        const baseline = normalizeTrackedFieldValue(
          descriptionEditBaselines[taskId] ?? entry.description,
        );
        const nextValue = normalizeTrackedFieldValue(entry.description);
        if (nextValue === baseline) return entry;
        saved = true;
        savedDescription = entry.description;
        const withHistory = appendFieldHistoryIfChanged(
          entry,
          "description",
          baseline,
          nextValue,
          "user",
        );
        return appendTaskActivity(withHistory, "user", activityAction);
      }),
    );
    if (!saved) return false;
    setDescriptionEditBaselines((prev) => ({
      ...prev,
      [taskId]: savedDescription ?? prev[taskId] ?? "",
    }));
    return true;
  }

  function persistDescriptionDraft(taskId: string) {
    if (commitDescriptionFieldHistory(taskId, "Beskrivelse gemt")) {
      showToast("Beskrivelse gemt.");
    } else {
      showToast("Ingen ændringer at gemme.");
    }
  }

  function toggleDescriptionEdit(task: Task) {
    if (detailDescriptionEditOpen) {
      commitDescriptionFieldHistory(task.id);
      setDetailDescriptionEditOpen(false);
      return;
    }
    setDescriptionEditBaselines((prev) => ({
      ...prev,
      [task.id]: task.description,
    }));
    setDetailDescriptionEditOpen(true);
  }

  function closeDetailPanel() {
    if (detailOpenId) {
      flushAllTaskAutoSaves(detailOpenId);
    }
    if (detailOpenId && detailDescriptionEditOpen) {
      commitDescriptionFieldHistory(detailOpenId);
      setDetailDescriptionEditOpen(false);
    }
    setDetailOpenId(null);
    setOpenPickerId(null);
  }

  function setAutoSaveStatus(taskId: string, kind: AutoSaveKind, status: AutoSaveStatus): void {
    setAutoSaveStatusByTask((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], [kind]: status },
    }));
    if (status === "saved") {
      const flashKey = autoSaveKey(kind, taskId);
      const existing = autoSaveFlashTimersRef.current.get(flashKey);
      if (existing) clearTimeout(existing);
      autoSaveFlashTimersRef.current.set(
        flashKey,
        setTimeout(() => {
          autoSaveFlashTimersRef.current.delete(flashKey);
          setAutoSaveStatusByTask((prev) => {
            const current = prev[taskId]?.[kind];
            if (current !== "saved") return prev;
            const nextKinds = { ...prev[taskId] };
            delete nextKinds[kind];
            if (Object.keys(nextKinds).length === 0) {
              const next = { ...prev };
              delete next[taskId];
              return next;
            }
            return { ...prev, [taskId]: nextKinds };
          });
        }, AUTO_SAVE_SAVED_FLASH_MS),
      );
    }
  }

  function getAutoSaveStatus(taskId: string, kind: AutoSaveKind): AutoSaveStatus {
    return autoSaveStatusByTask[taskId]?.[kind] ?? "idle";
  }

  function commitReviewDeliveryDraft(
    taskId: string,
    draft: ReviewDeliveryDraft,
    options?: { silent?: boolean; actor?: ActivityActor },
  ): boolean {
    let committed = false;
    setTasks((prev) => {
      const task = prev.find((entry) => entry.id === taskId);
      if (!task) return prev;
      if (deliveryDraftMatchesTask(task, draft)) return prev;
      const summary = draft.summary.trim();
      const heading = draft.heading.trim() || task.title;
      if (!hasReviewDeliveryReady(task, summary)) return prev;
      const scope = getReviewVerificationScope(task, draft.verificationScope);
      const urlInput = draft.verificationUrl.trim();
      if (scope === "stardesk" && urlInput && !normalizeVerificationUrl(urlInput)) {
        return prev;
      }
      const patched = applyReviewDeliveryToTask(
        task,
        heading,
        summary,
        options?.actor ?? "user",
        draft.verificationUrl,
        draft.verificationLabel,
        draft.verificationScope,
      );
      committed = true;
      return patchTaskFields(prev, taskId, {
        reviewDeliveryHeading: patched.reviewDeliveryHeading,
        reviewDeliverySummary: patched.reviewDeliverySummary,
        reviewDeliveryAt: patched.reviewDeliveryAt,
        reviewDeliveryActor: patched.reviewDeliveryActor,
        reviewVerificationScope: patched.reviewVerificationScope,
        reviewVerificationUrl: patched.reviewVerificationUrl,
        reviewVerificationLabel: patched.reviewVerificationLabel,
        fieldHistory: patched.fieldHistory,
        activityLog: patched.activityLog,
      });
    });
    if (committed) {
      setReviewDeliveryDrafts((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setAutoSaveStatus(taskId, "delivery", "saved");
      if (!options?.silent) showToast("Leverance til review gemt.");
    }
    return committed;
  }

  function commitReviewPrepDraft(
    taskId: string,
    draft: ReviewPrepDraft,
    options?: { silent?: boolean },
  ): boolean {
    let committed = false;
    setTasks((prev) => {
      const task = prev.find((entry) => entry.id === taskId);
      if (!task) return prev;
      if (reviewPrepDraftMatchesTask(task, draft)) return prev;
      const summary = draft.summary.trim();
      if (summary.length < REVIEW_DELIVERY_MIN_SUMMARY_LEN) return prev;
      const skills = (task.reviewPrepSkills?.length
        ? task.reviewPrepSkills
        : suggestReviewSkills(task).map((s) => s.id)) as string[];
      const reviewer = task.reviewPrepReviewer ?? suggestReviewer(task).id;
      const patched = applyReviewPrepToTask(task, draft.heading, summary, skills, reviewer);
      committed = true;
      return patchTaskFields(prev, taskId, {
        reviewPrepHeading: patched.reviewPrepHeading,
        reviewPrepSummary: patched.reviewPrepSummary,
        reviewPrepSkills: patched.reviewPrepSkills,
        reviewPrepReviewer: patched.reviewPrepReviewer,
        reviewPrepAt: patched.reviewPrepAt,
        reviewPrepActor: patched.reviewPrepActor,
        fieldHistory: patched.fieldHistory,
        activityLog: patched.activityLog,
      });
    });
    if (committed) {
      setReviewPrepDrafts((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setAutoSaveStatus(taskId, "prep", "saved");
      if (!options?.silent) showToast("Review-forberedelse gemt i Work Board-data.");
    }
    return committed;
  }

  function commitAgentPlanDraft(
    taskId: string,
    plan: string,
    options?: { silent?: boolean },
  ): boolean {
    let committed = false;
    setTasks((prev) => {
      const task = prev.find((entry) => entry.id === taskId);
      if (!task) return prev;
      if (agentPlanDraftMatchesTask(task, plan)) return prev;
      const trimmed = plan.trim();
      if (!hasAgentPlanReady(task, trimmed)) return prev;
      const patched = applyAgentPlanToTask(task, trimmed, "user");
      committed = true;
      return patchTaskFields(prev, taskId, {
        agentPlan: patched.agentPlan,
        agentPlanAt: patched.agentPlanAt,
        agentPlanActor: patched.agentPlanActor,
        fieldHistory: patched.fieldHistory,
        activityLog: patched.activityLog,
      });
    });
    if (committed) {
      setAgentPlanDrafts((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setAutoSaveStatus(taskId, "plan", "saved");
      if (!options?.silent) showToast("Agent-plan gemt.");
    }
    return committed;
  }

  function commitAgentReviewViewDraft(
    taskId: string,
    view: string,
    options?: { silent?: boolean; actor?: ActivityActor },
  ): boolean {
    let committed = false;
    setTasks((prev) => {
      const task = prev.find((entry) => entry.id === taskId);
      if (!task) return prev;
      if (agentReviewViewDraftMatchesTask(task, view)) return prev;
      const trimmed = view.trim();
      if (!trimmed) return prev;
      const patched = applyAgentReviewViewToTask(task, trimmed, options?.actor ?? "user");
      committed = true;
      return patchTaskFields(prev, taskId, {
        agentReviewView: patched.agentReviewView,
        agentReviewViewAt: patched.agentReviewViewAt,
        agentReviewViewActor: patched.agentReviewViewActor,
        fieldHistory: patched.fieldHistory,
        activityLog: patched.activityLog,
      });
    });
    if (committed) {
      setAgentReviewViewDrafts((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setAutoSaveStatus(taskId, "agentReviewView", "saved");
      if (!options?.silent) showToast("Agent View gemt.");
    }
    return committed;
  }

  autoSaveRunners = {
    commitDelivery: commitReviewDeliveryDraft,
    commitPrep: commitReviewPrepDraft,
    commitPlan: commitAgentPlanDraft,
    commitAgentReviewView: commitAgentReviewViewDraft,
    setStatus: setAutoSaveStatus,
  };

  function persistReviewDeliveryDraft(taskId: string) {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task) return;
    const draft = getReviewDeliveryDraftForTask(task);
    const summary = draft.summary.trim();
    if (!hasReviewDeliveryReady(task, summary)) {
      showToast(reviewDeliveryBlockMessage(task, summary));
      return;
    }
    const scope = getReviewVerificationScope(task, draft.verificationScope);
    const urlInput = draft.verificationUrl.trim();
    if (scope === "stardesk" && urlInput && !normalizeVerificationUrl(urlInput)) {
      showToast(REVIEW_VERIFICATION_INVALID_MESSAGE);
      return;
    }
    flushAutoSaveTimer("delivery", taskId);
    pendingDeliveryDrafts.delete(taskId);
    commitReviewDeliveryDraft(taskId, draft);
  }

  function persistReviewPrepDraft(taskId: string) {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task) return;
    const draft = getReviewPrepDraftForTask(task);
    const summary = draft.summary.trim();
    if (summary.length < REVIEW_DELIVERY_MIN_SUMMARY_LEN) {
      showToast("Skriv begrundelse i review-kassen (mindst et afsnit).");
      return;
    }
    flushAutoSaveTimer("prep", taskId);
    pendingReviewPrepDrafts.delete(taskId);
    commitReviewPrepDraft(taskId, draft);
  }

  async function runReviewPrepAgent(task: Task) {
    const prompt = buildReviewPrepPrompt(task);
    const copied = await copyTextToClipboard(prompt);
    dispatchCanvasAction({
      type: "newComposerChat",
      userPrompt: prompt,
    });
    setTasks((prev) =>
      hydrateTasksCore(prev).map((entry) =>
        entry.id === task.id
          ? appendTaskActivity(
              { ...entry, reviewPrepAgentStartedAt: Date.now() },
              "user",
              "Review-agent startet",
            )
          : entry,
      ),
    );
    const message = copied
      ? `Review-agent startet (ny chat). Udfyld kasse «Review-forberedelse» nederst — opgave #${formatTaskNumber(task)}.`
      : `Review-agent: start ny chat manuelt og brug prompt i udklipsholder.`;
    setReviewPrepFeedback({ taskId: task.id, message });
    showToast(message);
  }

  function requestMoveToReview(taskId: string) {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task || task.status !== "In Progress") return;
    const draft = getReviewPrepDraftForTask(task);
    if (!hasReviewPrepReady(task, draft.summary)) {
      void runReviewPrepAgent(task);
      return;
    }
    submitForReview(taskId);
  }

  function seedPendingDraftsForTask(taskId: string): void {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task) return;
    pendingDeliveryDrafts.set(taskId, getReviewDeliveryDraftForTask(task));
    pendingReviewPrepDrafts.set(taskId, getReviewPrepDraftForTask(task));
    pendingAgentPlanDrafts.set(taskId, getAgentPlanDraftForTask(task));
    pendingAgentReviewViewDrafts.set(taskId, getAgentReviewViewDraftForTask(task));
  }

  function submitForReview(taskId: string) {
    flushAutoSaveTimer("delivery", taskId);
    flushAutoSaveTimer("prep", taskId);
    flushAutoSaveTimer("plan", taskId);
    seedPendingDraftsForTask(taskId);
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task || task.status !== "In Progress") return;
    const effectiveTask = getTaskWithPendingDrafts(task);
    const draft = getReviewPrepDraftForTask(effectiveTask);
    const summary = draft.summary.trim();
    if (summary.length < REVIEW_DELIVERY_MIN_SUMMARY_LEN) {
      showToast(
        "Udfyld review-forberedelse nederst (begrundelse, min. et afsnit) — eller start review-agenten.",
      );
      return;
    }
    const deliveryDraft = getReviewDeliveryDraftForTask(effectiveTask);
    const deliverySummary = deliveryDraft.summary.trim();
    if (!hasReviewDeliveryReady(effectiveTask, deliverySummary)) {
      showToast(reviewDeliveryBlockMessage(effectiveTask, deliverySummary));
      return;
    }
    const planDraft = getAgentPlanDraftForTask(effectiveTask).trim();
    const planValue = planDraft || effectiveTask.agentPlan?.trim() || "";
    if (!hasAgentPlanReady(effectiveTask, planValue)) {
      showToast(AGENT_PLAN_REQUIRED_MESSAGE);
      return;
    }
    let agentReviewStartTask: Task | null = null;
    setTasks((prev) => {
      const current = hydrateTasksCore(prev);
      const source = current.find((entry) => entry.id === taskId);
      if (!source) return current;
      const remaining = current.filter((entry) => entry.id !== taskId);
      let merged = applyPendingDraftsInline(source);
      clearPendingDraftsForTask(taskId);
      merged = applyReviewTransitionEvidence(applyStatusToTask(merged, "Review"));
      merged = appendWorkflowTransitionActivity(merged, "In Progress", "Review", "agent");
      agentReviewStartTask = merged;
      return insertTaskAtColumnTop(remaining, merged, "Review");
    });
    setAgentPlanDrafts((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setReviewPrepDrafts((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    const wasRerun = taskNeedsAgentRerun(task);
    showToast(
      wasRerun
        ? `"${task.title}" genkørt → Agent Review (hårdt krav opfyldt)`
        : `"${task.title}" klar → Agent Review`,
      {
        kind: "restoreStatus",
        taskId,
        status: "In Progress",
      },
    );
    if (agentReviewStartTask) {
      void startAgentReviewAgent(agentReviewStartTask);
    }
  }

  function submitToHumanReview(taskId: string) {
    flushAutoSaveTimer("delivery", taskId);
    flushAutoSaveTimer("prep", taskId);
    flushAutoSaveTimer("plan", taskId);
    flushAutoSaveTimer("agentReviewView", taskId);
    const pendingView = pendingAgentReviewViewDrafts.get(taskId);
    if (pendingView != null) {
      commitAgentReviewViewDraft(taskId, pendingView, { silent: true });
      pendingAgentReviewViewDrafts.delete(taskId);
    }
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task || task.status !== "Review") return;
    const effectiveTask = getTaskWithPendingDrafts(task);
    const gate = getAgentReviewVerificationGate(effectiveTask);
    if (gate.blocked) {
      showToast(gate.message ?? "Agent Review fejlede — kan ikke sende til Human Review.");
      return;
    }
    if (gate.warn && gate.message) {
      showToast(gate.message);
    }
    if (!hasReviewDeliveryReady(effectiveTask)) {
      showToast(reviewDeliveryBlockMessage(effectiveTask));
      return;
    }
    if (!hasAgentPlanReady(effectiveTask)) {
      showToast(AGENT_PLAN_REQUIRED_MESSAGE);
      return;
    }
    setTasks((prev) => {
      const current = hydrateTasksCore(prev);
      const source = current.find((entry) => entry.id === taskId);
      if (!source || source.status !== "Review") return current;
      const remaining = current.filter((entry) => entry.id !== taskId);
      let merged = applyPendingDraftsInline(source);
      clearPendingDraftsForTask(taskId);
      merged = applyStatusToTask(merged, "Human Review");
      merged = appendWorkflowTransitionActivity(merged, "Review", "Human Review", "agent");
      return insertTaskAtColumnTop(remaining, merged, "Human Review");
    });
    setReviewDeliveryDrafts((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    showToast(`"${task.title}" sendt til Human Review`, {
      kind: "restoreStatus",
      taskId,
      status: "Review",
    });
  }

  function approveReviewTask(taskId: string) {
    flushAutoSaveTimer("delivery", taskId);
    flushAutoSaveTimer("prep", taskId);
    flushAutoSaveTimer("plan", taskId);
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task || task.status !== "Human Review") return;
    const preview = applyPendingDraftsInline(getTaskWithPendingDrafts(task));
    const { verificationUrl, verificationScope } = getReviewDelivery(preview);
    if (verificationScope === "stardesk" && !verificationUrl) {
      showToast(REVIEW_VERIFICATION_MISSING_MESSAGE);
    }
    setReviewRejectId(null);
    setReviewRejectReason("");
    setReviewRejectAttachments([]);
    setCloseConfirmId(null);
    setTasks((prev) => {
      const current = hydrateTasksCore(prev);
      const source = current.find((entry) => entry.id === taskId);
      if (!source || source.status !== "Human Review") return current;
      const remaining = current.filter((entry) => entry.id !== taskId);
      let merged = applyPendingDraftsInline(source);
      clearPendingDraftsForTask(taskId);
      merged = applyStatusToTask(merged, "Done");
      const movedTask = appendTaskActivity(
        merged,
        "user",
        `Flyttet til ${COLUMN_LABELS.Done}`,
      );
      return insertTaskAtColumnTop(remaining, movedTask, "Done");
    });
    setReviewDeliveryDrafts((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    showToast(`"${task.title}" godkendt → Done`, {
      kind: "restoreStatus",
      taskId,
      status: "Human Review",
    });
  }

  function rejectReviewTask(taskId: string) {
    const trimmed = reviewRejectReason.trim();
    const attachments = [...reviewRejectAttachments];
    if (!trimmed && attachments.length === 0) return;
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task || task.status !== "Human Review") return;
    const targetStatus: Status = "In Progress";
    const rerunAt = Date.now();
    const { images: imageCount, videos: videoCount } =
      countReviewRejectAttachments(attachments);
    const rerunReason = formatAgentRerunReasonText(trimmed, imageCount, videoCount);
    const attachmentNote = formatReviewRejectAttachmentSummary(imageCount, videoCount);
    const activityDetail =
      trimmed && attachmentNote
        ? `${trimmed}\n\n${attachmentNote} vedhæftet.`
        : trimmed || (attachmentNote ? `${attachmentNote} vedhæftet.` : "");
    let movedTask: Task | null = null;
    setTasks((prev) => {
      const current = hydrateTasksCore(prev);
      const source = current.find((entry) => entry.id === taskId);
      if (!source) return current;
      const remaining = current.filter((entry) => entry.id !== taskId);
      const previousDescription = source.description;
      const nextDescription = `${source.description}${buildReviewRejectionAppend(trimmed, imageCount, videoCount)}`;
      movedTask = appendFieldHistoryIfChanged(
        appendTaskActivity(
          {
            ...source,
            description: nextDescription,
            status: targetStatus,
            agentRerunRequired: true,
            agentRerunReason: rerunReason,
            agentRerunAt: rerunAt,
            reviewRejectAttachments:
              attachments.length > 0 ? attachments : undefined,
          },
          "user",
          "Review afvist (Human Review)",
          activityDetail,
        ),
        "description",
        previousDescription,
        nextDescription,
        "user",
      );
      return insertTaskAtColumnTop(remaining, movedTask, targetStatus);
    });
    setReviewRejectId(null);
    setReviewRejectReason("");
    setReviewRejectAttachments([]);
    setCloseConfirmId(null);
    if (movedTask) {
      void startInProgressAgent(movedTask);
    }
    showToast(`"${task.title}" afvist → I gang (agent genkører)`, {
      kind: "restoreStatus",
      taskId,
      status: "Human Review",
    });
  }

  function setColumnWidth(column: Status, width: number) {
    setColumnWidths((prev) => ({ ...prev, [column]: width }));
  }

  function nudgeColumnWidth(column: Status, step: -1 | 1) {
    const current = columnWidths[column] ?? 300;
    const nextIndex = Math.max(
      0,
      Math.min(COLUMN_WIDTH_SNAPS.length - 1, nearestSnapIndex(current) + step),
    );
    const nextWidth = COLUMN_WIDTH_SNAPS[nextIndex] ?? current;
    setColumnWidth(column, nextWidth);
  }

  function setAllColumnWidths(width: number) {
    const snapped = COLUMN_WIDTH_SNAPS[nearestSnapIndex(width)] ?? width;
    const next: Record<string, number> = {};
    for (const column of COLUMNS) next[column] = snapped;
    setColumnWidths(next);
  }

  function startColumnResize(column: Status, startX: number, startWidth: number) {
    const onMove = (event: MouseEvent) => {
      const raw = Math.max(88, Math.min(720, startWidth + (event.clientX - startX)));
      setColumnWidth(column, snapWidth(raw));
    };
    const onUp = () => {
      globalThis.removeEventListener?.("mousemove", onMove);
      globalThis.removeEventListener?.("mouseup", onUp);
      setResizing(null);
      const viewport = getBoardScrollViewport();
      if (viewport) updateBoardScrollMetrics(viewport);
    };
    setResizing({ column, startX, startWidth });
    globalThis.addEventListener?.("mousemove", onMove);
    globalThis.addEventListener?.("mouseup", onUp);
  }

  function updateTask(taskId: string, patch: Partial<Task>) {
    const task = hydratedTasks.find((entry) => entry.id === taskId);
    if (!task) return;

    if (patch.status) {
      const gate = validateWorkboardStatusChange(task, patch.status);
      if (!gate.allowed) {
        showToast(gate.message);
        return;
      }
      if (patch.status === "Review" && taskNeedsAgentRerun(task)) {
        patch = { ...patch, agentRerunRequired: false, agentRerunReason: undefined, agentRerunAt: undefined };
      }
    }

    const evidencePassed =
      patch.agentReviewEvidence?.status === "passed" &&
      task.agentReviewEvidence?.status !== "passed" &&
      task.status === "Review";
    if (evidencePassed && AGENT_REVIEW_AUTO_HUMAN_ON_PASSED) {
      setTasks((prev) => {
        const current = hydrateTasksCore(prev);
        const withEvidence = current.map((entry) =>
          entry.id === taskId ? { ...entry, ...patch } : entry,
        );
        return promotePassedAgentReviewTasks(withEvidence);
      });
      return;
    }

    const statusChanged = patch.status != null && patch.status !== task.status;
    if (statusChanged && patch.status) {
      let agentReviewStartTask: Task | null = null;
      setTasks((prev) => {
        const current = hydrateTasksCore(prev);
        const source = current.find((entry) => entry.id === taskId);
        if (!source) return current;
        const remaining = current.filter((entry) => entry.id !== taskId);
        const { status, ...rest } = patch;
        let merged = applyStatusToTask({ ...source, ...rest }, status as Status);
        if (status === "Review") {
          merged = applyReviewTransitionEvidence(merged);
          agentReviewStartTask = merged;
        }
        merged = status
          ? appendWorkflowTransitionActivity(merged, source.status, status as Status, "user")
          : merged;
        return insertTaskAtColumnTop(remaining, merged, status as Status);
      });
      if (patch.status === "Review" && agentReviewStartTask) {
        void startAgentReviewAgent(agentReviewStartTask);
      }
      return;
    }

    const activityAction =
      patch.title != null && patch.title !== task.title
        ? "Titel opdateret"
        : patch.owner != null && patch.owner !== task.owner
          ? "Owner opdateret"
          : patch.tags != null && patch.tags !== task.tags
            ? "Tags opdateret"
            : null;

    setTasks((prev) =>
      prev.map((entry) => {
        if (entry.id !== taskId) return entry;
        let next: Task = { ...entry, ...patch };
        if (patch.fieldHistory != null) {
          next.fieldHistory = mergeFieldHistoryPreserved(entry.fieldHistory, patch.fieldHistory);
        }
        if (activityAction) {
          next = appendTaskActivity(next, "user", activityAction);
        }
        return next;
      }),
    );
  }

  function createTaskFromDraft() {
    if (!newTaskDraft) return;
    const title = newTaskDraft.title.trim();
    if (!title) return;
    const id = `t-${Date.now()}`;
    const merged = hydrateTasksCore(tasks);
    const parent =
      newTaskDraft.parentId != null
        ? merged.find((entry) => entry.id === newTaskDraft.parentId)
        : null;
    const status = parent?.status ?? newTaskDraft.status;
    const newTask: Task = ensureFieldHistoryBackfill({
      id,
      number: nextTaskNumber(merged),
      title,
      description: newTaskDraft.description.trim() || "Beskrivelse...",
      status,
      priority: newTaskDraft.priority,
      owner: newTaskDraft.owner.trim(),
      tags: newTaskDraft.tags.trim(),
      source: parent ? `Underopgave til #${parent.number}` : "Canvas",
      parentId: newTaskDraft.parentId,
      createdAt: Date.now(),
      activityLog: [
        {
          at: Date.now(),
          actor: "user",
          action: "Opgave oprettet",
          detail: title,
        },
      ],
    });
    setTasks((prev) => {
      const current = hydrateTasksCore(prev);
      const insertIndex = insertIndexAtTopOfColumn(current, status);
      return assignBoardIndices([...current.slice(0, insertIndex), newTask, ...current.slice(insertIndex)]);
    });
    if (newTaskDraft.parentId) {
      setChildrenPanelParentId(newTaskDraft.parentId);
    }
    setNewTaskDraft(null);
    openTask(id);
    showToast(`"${title}" oprettet`, { kind: "removeCreated", taskId: id });
    if (isPipelineStartStatus(status) && !hasKodeklarSpec(newTask)) {
      void startPipelineAgent(newTask, "kodeklar");
    }
  }

  boardViewportScrollRestore = boardScrollLeft;
  boardViewportSetMetrics = setBoardScrollMetrics;

  return (
    <Stack gap={14} style={{ position: "relative", minWidth: 0, width: "100%" }}>
      <WorkBoardPulseKeyframes />
      <WorkBoardScrollStyles theme={theme} />
      <Stack gap={4}>
        <H1>STARdesk Work Board</H1>
        <Text tone="secondary" weight="semibold">
          Pipeline: Bobler/Backlog → kodeklar → Refinement → plan → Ready → I gang → Agent Review →
          Human Review. Genkørt sag skal tilbage til Agent Review (aldrig Done fra I gang).
        </Text>
        <Text tone="secondary">
          Træk kort med ⋮⋮. Dobbeltklik titel for at åbne. Klik en sag med underopgaver for at
          vise dem i en midlertidig kolonne til højre — klik væk for at lukke. Brug "Manuel" for
          drag. Scroll boardet med bund-bjælken, pile eller træk på tom kolonne-flade. Ctrl+scroll
          (⌘+scroll på Mac) zoomer boardet ind/ud. Gem gemmer lokalt i Work Board-data
          (canvas.data.json). Neon-sync er valgfri under Database-sync.
        </Text>
        <Row gap={8} align="center" wrap>
          {selectedId ? (
            <Button type="button" variant="primary" onClick={() => openTask(selectedId)}>
              Åbn valgt kort
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setNewTaskDraft({
                title: "",
                description: "",
                status: "Backlog",
                priority: "P2",
                owner: "",
                tags: "",
              })
            }
          >
            Ny opgave
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAllColumnWidths(108)}>
            Smal visning
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAllColumnWidths(300)}>
            Normal visning
          </Button>
          <Button type="button" variant="ghost" onClick={() => setColumnWidths({})}>
            Reset kolonnebredder
          </Button>
          <Button type="button" variant="secondary" onClick={() => saveWorkboardLocally()}>
            Gem
          </Button>
          {formatLocalSaveLabel(localSaveStatus) ? (
            <Text size="small" tone="secondary">
              {formatLocalSaveLabel(localSaveStatus)}
            </Text>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDbSyncSettingsOpen((open) => !open)}
          >
            Database-sync
          </Button>
          {(() => {
            const display = getDbSyncToolbarDisplay(dbSyncStatus);
            return (
              <Row gap={6} align="center" wrap>
                <Text size="small" tone={display.tone} weight="semibold">
                  {display.statusText}
                </Text>
                {display.timestamp ? (
                  <Text size="small" tone="secondary">
                    {display.timestamp}
                  </Text>
                ) : null}
                {display.errorDetail ? (
                  <span title={display.errorDetail}>
                    <Text size="small" tone="primary">
                      {display.errorDetail.length > 48
                        ? `${display.errorDetail.slice(0, 48)}…`
                        : display.errorDetail}
                    </Text>
                  </span>
                ) : null}
              </Row>
            );
          })()}
        </Row>
        {dbSyncSettingsOpen ? (
          <Stack gap={8} style={{ maxWidth: 520 }}>
            <Text size="small" tone="secondary">
              Gem (toolbar) flusher kladder til canvas.data.json (UI-cache). Med API-token gemmes
              alle ændringer automatisk til Neon efter kort pause (~2,5 s) — plus valgfri backup hvert
              5. minut.
            </Text>
            <Text size="small" tone="secondary">
              Staff JWT fra /api/v1/auth/login. Token gemmes lokalt i canvas.data.json — commit ikke
              filen med token.
            </Text>
            <Row gap={8} align="center" wrap>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void saveWorkboardToDb("manual")}
                disabled={dbSyncStatus.state === "saving"}
              >
                Gem til Neon
              </Button>
              {formatDbSyncLabel(dbSyncStatus) ? (
                <Text
                  size="small"
                  tone={dbSyncStatus.state === "error" ? "primary" : "secondary"}
                >
                  {formatDbSyncLabel(dbSyncStatus)}
                </Text>
              ) : null}
            </Row>
            <Checkbox
              checked={dbAutosaveEnabled}
              onChange={setDbAutosaveEnabled}
              label="Auto-gem til Neon ved ændringer (debounce ~2,5 s) + backup hvert 5. minut"
            />
            <Stack gap={4}>
              <Text size="small" weight="semibold">
                API URL
              </Text>
              <TextInput
                value={dbSyncApiUrl}
                onChange={(value) => setDbSyncApiUrl(value)}
                placeholder={WORKBOARD_DEFAULT_API_URL}
              />
            </Stack>
            <Stack gap={4}>
              <Text size="small" weight="semibold">
                API-token (Bearer JWT)
              </Text>
              <TextInput
                value={dbSyncApiToken}
                onChange={(value) => setDbSyncApiToken(value)}
                placeholder="Indsæt token én gang"
              />
            </Stack>
          </Stack>
        ) : null}
      </Stack>

      {openSortColumn || (childrenPanelParentId && !detailOpenId) ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 180,
          }}
          onClick={dismissEphemeralPanels}
        />
      ) : null}

      <BoardScrollControls
        setScrollLeft={setBoardScrollLeft}
        onMetricsUpdate={updateBoardScrollMetrics}
      />

      <div
        id={BOARD_SCROLL_VIEWPORT_ID}
        className="stardesk-board-scroll-viewport"
        ref={attachBoardViewportRef}
        onScroll={handleBoardViewportScroll}
        onMouseDown={handleBoardPanStart}
        style={{
          cursor:
            draggingId || boardMaxScrollLeft(boardScrollMetrics) <= 0
              ? "default"
              : "grab",
          paddingBottom: 4,
        }}
      >
        <div
          className="stardesk-board-zoom-content"
          style={{ zoom: boardZoom }}
        >
        <Row
          gap={10}
          align="start"
          style={{
            width: "max-content",
            minWidth: "100%",
            flexWrap: "nowrap",
          }}
        >
          {COLUMNS.map((column) => {
            const sortMode = columnSorts[column] ?? "manual";
            const columnTasks = sortTasks(
              rootTasks.filter((task) => task.status === column),
              sortMode,
            );
            const width = columnWidths[column] ?? 300;
            const isCompact = width <= COMPACT_MAX_WIDTH;
            return (
              <div
                key={column}
                id={boardScrollColumnId(column)}
                style={{ flexShrink: 0 }}
              >
              <Card
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const droppedId = resolveDroppedTaskId(draggingId, event.dataTransfer);
                  if (!droppedId) return;
                  moveTask(droppedId, column);
                  clearDraggingTaskId();
                  setDraggingId(null);
                  setDragOverTaskId(null);
                }}
                style={{
                  width,
                  minWidth: width,
                  borderColor: theme.stroke.primary,
                  background: theme.bg.elevated,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <ColumnHeader
                  column={column}
                  width={width}
                  columnTaskCount={columnTasks.length}
                  sortMode={sortMode}
                  openSortColumn={openSortColumn}
                  setOpenSortColumn={setOpenSortColumn}
                  theme={theme}
                  onExpand={() => nudgeColumnWidth(column, 1)}
                  onSortChange={(mode) =>
                    setColumnSorts((prev) => ({ ...prev, [column]: mode }))
                  }
                  customLabels={columnLabels}
                  setCustomLabels={setColumnLabels}
                  showToast={showToast}
                />
                {!isCompact ? (
                <CardBody>
                  {(() => {
                    const hint = getColumnWorkflowHint(column);
                    return hint ? <ColumnWorkflowHintBox theme={theme} hint={hint} /> : null;
                  })()}
                  <Stack
                    gap={8}
                    style={{ minHeight: 120 }}
                  >
                    <div
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const droppedId = resolveDroppedTaskId(draggingId, event.dataTransfer);
                        if (!droppedId) return;
                        moveTask(droppedId, column);
                        clearDraggingTaskId();
                        setDraggingId(null);
                        setDragOverTaskId(null);
                      }}
                      style={{
                        minHeight: 80,
                        border: `1px dashed ${theme.stroke.tertiary}`,
                        borderRadius: 8,
                        padding: 6,
                      }}
                    >
                      <Stack gap={8}>
                        {columnTasks.map((task) => {
                          const childCount = getChildTasks(hydratedTasks, task.id).length;
                          const showCardActions =
                            hoveredTaskId === task.id ||
                            selectedId === task.id ||
                            closeConfirmId === task.id ||
                            reviewRejectId === task.id;
                          const isInAgentReview = isAgentReviewStatus(task.status);
                          const isInHumanReview = isHumanReviewStatus(task.status);
                          const agentReviewGate = isInAgentReview
                            ? getAgentReviewVerificationGate(task)
                            : null;
                          const canRequestInProgress = REQUEST_IN_PROGRESS_FROM.includes(
                            task.status,
                          );
                          const canStartWorkflow = isPipelineStartStatus(task.status);
                          const isRefinement = task.status === "Refinement";
                          const isInProgress = task.status === "In Progress";
                          const needsAgentRerun = isInProgress && taskNeedsAgentRerun(task);
                          const inProgressChrome = isInProgress
                            ? inProgressCardChrome(theme, needsAgentRerun)
                            : null;
                          return (
                          <Stack
                            key={task.id}
                            gap={4}
                            onMouseEnter={() => setHoveredTaskId(task.id)}
                            onMouseLeave={() => {
                              if (closeConfirmId !== task.id) {
                                setHoveredTaskId((prev) => (prev === task.id ? null : prev));
                              }
                            }}
                          >
                            <div
                              onDragOver={(event) => {
                                event.preventDefault();
                                if (draggingId && draggingId !== task.id) {
                                  setDragOverTaskId(task.id);
                                }
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const droppedId = resolveDroppedTaskId(draggingId, event.dataTransfer);
                                if (!droppedId || droppedId === task.id) return;
                                moveTask(droppedId, column, task.id);
                                clearDraggingTaskId();
                                setDraggingId(null);
                                setDragOverTaskId(null);
                              }}
                              style={{
                                height: 6,
                                borderRadius: 4,
                                background:
                                  dragOverTaskId === task.id
                                    ? theme.stroke.primary
                                    : "transparent",
                              }}
                            />
                            <div
                              data-board-card=""
                              onMouseDown={(event) => event.stopPropagation()}
                            >
                            <Stack
                              gap={6}
                              style={{
                                border:
                                  inProgressChrome?.border ??
                                  `1px solid ${theme.stroke.primary}`,
                                borderRadius: 8,
                                padding: "6px 8px",
                                background:
                                  inProgressChrome?.background ??
                                  (selectedId === task.id
                                    ? theme.fill.secondary
                                    : theme.bg.elevated),
                              }}
                            >
                              <Row gap={6} align="center">
                                <div
                                  draggable
                                  title="Træk for at flytte"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onDragStart={(event) => {
                                    event.stopPropagation();
                                    setDraggingId(task.id);
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData(
                                      "application/x-stardesk-task",
                                      task.id,
                                    );
                                  }}
                                  onDragEnd={() => {
                                    setDraggingId(null);
                                    setDragOverTaskId(null);
                                  }}
                                  style={{
                                    cursor: "grab",
                                    color: theme.text.tertiary,
                                    userSelect: "none",
                                    padding: "0 2px",
                                    fontSize: 14,
                                    lineHeight: 1,
                                    flexShrink: 0,
                                  }}
                                >
                                  ⋮⋮
                                </div>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  title={`${task.title} (dobbeltklik for at åbne)`}
                                  onClick={() => handleCardActivate(task.id)}
                                  onDoubleClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openTask(task.id);
                                  }}
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Row gap={6} align="center" justify="space-between">
                                    <Row gap={6} align="center" style={{ minWidth: 0, flex: 1 }}>
                                      <Text
                                        size="small"
                                        tone="secondary"
                                        style={{
                                          flexShrink: 0,
                                          fontVariantNumeric: "tabular-nums",
                                          minWidth: 22,
                                        }}
                                      >
                                        {formatTaskNumber(task)}
                                      </Text>
                                      {childCount > 0 ? (
                                        <Text
                                          size="small"
                                          tone="tertiary"
                                          title={`${childCount} underopgave${childCount === 1 ? "" : "r"}`}
                                          style={{ flexShrink: 0 }}
                                        >
                                          ▸{childCount}
                                        </Text>
                                      ) : null}
                                      <Text
                                        weight="semibold"
                                        style={{ lineHeight: 1.3, minWidth: 0 }}
                                      >
                                        {task.title}
                                      </Text>
                                    </Row>
                                    <Text
                                      size="small"
                                      style={{
                                        color: priorityColor(task.priority, theme),
                                        fontWeight: 600,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {task.priority}
                                    </Text>
                                  </Row>
                                </div>
                              </Row>
                              {canStartWorkflow ? (
                                <Row gap={4} align="center" justify="end" wrap>
                                  <Button
                                    variant="primary"
                                    onClick={() => requestStartWorkflow(task.id)}
                                  >
                                    {hasKodeklarSpec(task) ? "→ Refinement" : "Start workflow"}
                                  </Button>
                                  <IconButton
                                    title="Åbn sag"
                                    size="sm"
                                    onClick={() => openTask(task.id)}
                                  >
                                    ↗
                                  </IconButton>
                                </Row>
                              ) : isRefinement ? (
                                <Row gap={4} align="center" justify="end" wrap>
                                  <Button
                                    variant="secondary"
                                    onClick={() => void startPipelineAgent(task, "refinement")}
                                  >
                                    Plan-agent
                                  </Button>
                                  <IconButton
                                    title="Åbn sag"
                                    size="sm"
                                    onClick={() => openTask(task.id)}
                                  >
                                    ↗
                                  </IconButton>
                                </Row>
                              ) : canRequestInProgress ? (
                                <Row gap={4} align="center" justify="end" wrap>
                                  <Button
                                    variant="primary"
                                    onClick={() => requestInProgress(task.id)}
                                  >
                                    I gang
                                  </Button>
                                  <IconButton
                                    title="Åbn sag"
                                    size="sm"
                                    onClick={() => openTask(task.id)}
                                  >
                                    ↗
                                  </IconButton>
                                </Row>
                              ) : isInProgress ? (
                                <InProgressCardStatusRow
                                  theme={theme}
                                  task={task}
                                  onOpen={() => openTask(task.id)}
                                />
                              ) : isInAgentReview || isInHumanReview ? (
                                <Stack gap={6}>
                                  <ReviewDeliveryViewPanel
                                    task={task}
                                    theme={theme}
                                    compact
                                    showVerification={isInHumanReview}
                                  />
                                  <Row gap={4} align="center" justify="end" wrap>
                                    {isInAgentReview ? (
                                      <Button
                                        variant="secondary"
                                        onClick={() => submitToHumanReview(task.id)}
                                        disabled={agentReviewGate?.blocked === true}
                                      >
                                        → Human Review
                                      </Button>
                                    ) : null}
                                    <IconButton
                                      title={
                                        isInHumanReview
                                          ? "Åbn sag for human review"
                                          : "Åbn sag for agent review"
                                      }
                                      size="sm"
                                      onClick={() => openTask(task.id)}
                                    >
                                      ↗
                                    </IconButton>
                                  </Row>
                                </Stack>
                              ) : showCardActions ? (
                                <Row gap={4} align="center" justify="end" wrap>
                                  <IconButton
                                    title="Flyt op"
                                    size="sm"
                                    onClick={() => moveTaskByOffset(task.id, -1)}
                                  >
                                    ↑
                                  </IconButton>
                                  <IconButton
                                    title="Flyt ned"
                                    size="sm"
                                    onClick={() => moveTaskByOffset(task.id, 1)}
                                  >
                                    ↓
                                  </IconButton>
                                  {task.status !== "Archived" ? (
                                    <Button
                                      variant="secondary"
                                      onClick={() =>
                                        setCloseConfirmId((prev) =>
                                          prev === task.id ? null : task.id,
                                        )
                                      }
                                    >
                                      Luk
                                    </Button>
                                  ) : null}
                                  <IconButton
                                    title="Åbn sag"
                                    size="sm"
                                    onClick={() => openTask(task.id)}
                                  >
                                    ↗
                                  </IconButton>
                                </Row>
                              ) : null}
                            </Stack>
                            </div>
                            {closeConfirmId === task.id && task.status !== "Archived" ? (
                              <Row gap={6} align="center" justify="end">
                                <Button variant="ghost" onClick={() => setCloseConfirmId(null)}>
                                  Annuller
                                </Button>
                                <Button variant="primary" onClick={() => closeTask(task.id)}>
                                  Bekræft luk
                                </Button>
                              </Row>
                            ) : null}
                          </Stack>
                          );
                        })}
                        <div
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragOverTaskId(`end:${column}`);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const droppedId = resolveDroppedTaskId(draggingId, event.dataTransfer);
                            if (!droppedId) return;
                            moveTask(droppedId, column);
                            clearDraggingTaskId();
                            setDraggingId(null);
                            setDragOverTaskId(null);
                          }}
                          style={{
                            height: 8,
                            borderRadius: 4,
                            background:
                              dragOverTaskId === `end:${column}`
                                ? theme.stroke.primary
                                : "transparent",
                          }}
                        />
                      </Stack>
                    </div>
                  </Stack>
                </CardBody>
                ) : null}
                <div
                  title={`Træk for at ændre bredde på ${COLUMN_LABELS[column]}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startColumnResize(column, event.clientX, width);
                  }}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 14,
                    height: "100%",
                    cursor: "col-resize",
                    background:
                      resizing?.column === column ? theme.fill.secondary : theme.stroke.tertiary,
                    opacity: resizing?.column === column ? 0.9 : 0.35,
                    zIndex: 30,
                  }}
                />
              </Card>
              </div>
            );
          })}
          {childrenPanelParent && childrenPanelTasks.length > 0 ? (
            <Card
              style={{
                width: 280,
                minWidth: 280,
                borderColor: theme.stroke.primary,
                background: theme.bg.elevated,
                position: "relative",
                zIndex: 210,
                flexShrink: 0,
              }}
            >
              <Row
                gap={8}
                align="center"
                style={{
                  padding: "10px 12px",
                  borderBottom: `1px solid ${theme.stroke.tertiary}`,
                }}
              >
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="semibold">Underopgaver</Text>
                  <Text size="small" tone="secondary">
                    #{formatTaskNumber(childrenPanelParent)} {childrenPanelParent.title}
                  </Text>
                </Stack>
                <Button variant="ghost" onClick={() => setChildrenPanelParentId(null)}>
                  Luk
                </Button>
              </Row>
              <CardBody>
                <Stack gap={8}>
                  {childrenPanelTasks.map((child) => {
                    const childInProgress = child.status === "In Progress";
                    const childChrome = childInProgress
                      ? inProgressCardChrome(theme, taskNeedsAgentRerun(child))
                      : null;
                    return (
                    <Stack
                      key={child.id}
                      gap={4}
                      style={{
                        border:
                          childChrome?.border ?? `1px solid ${theme.stroke.primary}`,
                        borderRadius: 8,
                        padding: "6px 8px",
                        background:
                          childChrome?.background ??
                          (selectedId === child.id ? theme.fill.secondary : theme.bg.elevated),
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setSelectedId(child.id);
                        setLastClick({ id: child.id, time: Date.now() });
                      }}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openTask(child.id);
                      }}
                    >
                      <Row gap={6} align="center" justify="space-between">
                        <Row gap={6} align="center" style={{ minWidth: 0, flex: 1 }}>
                          <Text
                            size="small"
                            tone="secondary"
                            style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
                          >
                            {formatTaskNumber(child)}
                          </Text>
                          <Text weight="semibold" style={{ lineHeight: 1.3, minWidth: 0 }}>
                            {child.title}
                          </Text>
                        </Row>
                        <Text
                          size="small"
                          style={{
                            color: priorityColor(child.priority, theme),
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {child.priority}
                        </Text>
                      </Row>
                      {childInProgress ? (
                        <InProgressCardStatusRow
                          theme={theme}
                          task={child}
                          onOpen={() => openTask(child.id)}
                        />
                      ) : (
                        <Text size="small" tone="tertiary">
                          {COLUMN_SHORT_LABELS[child.status]}
                        </Text>
                      )}
                    </Stack>
                    );
                  })}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setNewTaskDraft({
                        title: "",
                        description: "",
                        status: childrenPanelParent.status,
                        priority: childrenPanelParent.priority,
                        owner: "",
                        tags: "",
                        parentId: childrenPanelParent.id,
                      });
                    }}
                  >
                    + Underopgave
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          ) : null}
        </Row>
        </div>
      </div>

      <BoardScrollTrackBar
        theme={theme}
        scrollLeft={boardScrollLeft}
        setScrollLeft={setBoardScrollLeft}
        metrics={boardScrollMetrics}
        onMetricsUpdate={updateBoardScrollMetrics}
      />

      <BoardZoomControls boardZoom={boardZoom} setBoardZoom={setBoardZoom} />

      {detailTask ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 220,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: 20,
            overflowY: "auto",
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDetailPanel();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workboard-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
          <Card
            style={{
              width: 780,
              maxWidth: "95%",
              borderColor: theme.stroke.primary,
            }}
          >
            <CardHeader trailing="Klik udenfor eller Tilbage">
              <span id="workboard-detail-title">
                Sag #{formatTaskNumber(detailTask)}: {detailTask.title}
              </span>
            </CardHeader>
            <CardBody>
              <Stack gap={12}>
                <Stack gap={0}>
                  {(() => {
                    const panelHeights = resolveDetailPanelHeights(detailPanelHeights);
                    const descriptionLines = countTextLines(detailTask.description);
                    const planDraft = getAgentPlanDraftForTask(detailTask);
                    const planText =
                      planDraft.trim() ||
                      detailTask.agentPlan?.trim() ||
                      "";
                    const planLines = countTextLines(planText);
                    const reviewDraft = getReviewDeliveryDraftForTask(detailTask);
                    const agentReviewViewDraft = getAgentReviewViewDraftForTask(detailTask);
                    const reviewText =
                      reviewDraft.summary.trim() ||
                      detailTask.reviewDeliverySummary?.trim() ||
                      "";
                    const reviewLines = countTextLines(
                      `${reviewText}\n${agentReviewViewDraft.trim() || detailTask.agentReviewView?.trim() || ""}`,
                    );
                    const resetPanelHeightsAuto = () => setDetailPanelHeights("auto");

                    return (
                      <>
                  <ResizableDetailSection
                    height={panelHeights.description}
                    contentLineCount={descriptionLines}
                  >
                    <TaskDescriptionBriefPanel task={detailTask} theme={theme} />
                  </ResizableDetailSection>

                  <DetailPanelResizeHandle
                    theme={theme}
                    title="Træk for at ændre højde · dobbeltklik for auto"
                    active={detailPanelResizing?.edge === "description-plan"}
                    onResetAuto={resetPanelHeightsAuto}
                    onMouseDown={(event) =>
                      startDetailPanelResize("description-plan", event.clientY)
                    }
                  />

                  <ResizableDetailSection
                    height={panelHeights.plan}
                    contentLineCount={planLines}
                  >
                    <AgentPlanPanel
                      task={detailTask}
                      theme={theme}
                      draft={planDraft}
                      onDraftChange={(value) => {
                        pendingAgentPlanDrafts.set(detailTask.id, value);
                        setAgentPlanDrafts((prev) => ({
                          ...prev,
                          [detailTask.id]: value,
                        }));
                        if (!isAnyReviewColumnStatus(detailTask.status)) {
                          scheduleAgentPlanAutoSave(detailTask.id, value);
                        }
                      }}
                      readOnly={isAnyReviewColumnStatus(detailTask.status)}
                      autoSaveStatus={getAutoSaveStatus(detailTask.id, "plan")}
                    />
                  </ResizableDetailSection>

                  {detailTask.status !== "Archived" ? (
                    <>
                      <DetailPanelResizeHandle
                        theme={theme}
                        title="Træk for at ændre højde · dobbeltklik for auto"
                        active={detailPanelResizing?.edge === "plan-review"}
                        onResetAuto={resetPanelHeightsAuto}
                        onMouseDown={(event) =>
                          startDetailPanelResize("plan-review", event.clientY)
                        }
                      />

                      <ResizableDetailSection
                        height={panelHeights.review}
                        contentLineCount={reviewLines}
                      >
                        {(() => {
                          const sharedReviewPanelProps = {
                            task: detailTask,
                            theme,
                            draft: reviewDraft,
                            onDraftChange: (next: ReviewDeliveryDraft) => {
                              if (isHumanReviewStatus(detailTask.status)) return;
                              pendingDeliveryDrafts.set(detailTask.id, next);
                              setReviewDeliveryDrafts((prev) => ({
                                ...prev,
                                [detailTask.id]: next,
                              }));
                              scheduleReviewDeliveryAutoSave(detailTask.id, next);
                            },
                            deliveryReady: hasReviewDeliveryReady(
                              detailTask,
                              reviewDraft.summary,
                            ),
                            autoSaveStatus: getAutoSaveStatus(detailTask.id, "delivery"),
                            agentReviewViewDraft,
                            onAgentReviewViewChange: (value: string) => {
                              if (isHumanReviewStatus(detailTask.status)) return;
                              pendingAgentReviewViewDrafts.set(detailTask.id, value);
                              setAgentReviewViewDrafts((prev) => ({
                                ...prev,
                                [detailTask.id]: value,
                              }));
                              if (isAgentReviewStatus(detailTask.status)) {
                                scheduleAgentReviewViewAutoSave(detailTask.id, value);
                              }
                            },
                            agentReviewViewAutoSaveStatus: getAutoSaveStatus(
                              detailTask.id,
                              "agentReviewView",
                            ),
                            showRequiredHint:
                              detailTask.status === "In Progress" ||
                              detailTask.status === "Ready" ||
                              detailTask.status === "Refinement" ||
                              detailTask.status === "Backlog",
                            readOnly: isHumanReviewStatus(detailTask.status),
                            openPickerId,
                            setOpenPickerId,
                            reviewRejectOpen: reviewRejectId === detailTask.id,
                            reviewRejectReason,
                            reviewRejectAttachments,
                            onReviewRejectReasonChange: setReviewRejectReason,
                            onReviewRejectAttachmentsChange: setReviewRejectAttachments,
                            onReviewRejectAttachmentError: showToast,
                            agentPlan: detailTask.agentPlan,
                            agentReviewGate: isAgentReviewStatus(detailTask.status)
                              ? getAgentReviewVerificationGate(detailTask)
                              : null,
                            onStartAgentReview: isAgentReviewStatus(detailTask.status)
                              ? () => void startAgentReviewAgent(detailTask)
                              : undefined,
                            onApprove: () => {
                              if (isAgentReviewStatus(detailTask.status)) {
                                submitToHumanReview(detailTask.id);
                              } else {
                                approveReviewTask(detailTask.id);
                              }
                              closeDetailPanel();
                            },
                            onRejectToggle: () => {
                              setReviewRejectId((prev) =>
                                prev === detailTask.id ? null : detailTask.id,
                              );
                              if (reviewRejectId === detailTask.id) {
                                setReviewRejectReason("");
                                setReviewRejectAttachments([]);
                              }
                            },
                            onRejectCancel: () => {
                              setReviewRejectId(null);
                              setReviewRejectReason("");
                              setReviewRejectAttachments([]);
                            },
                            onRejectConfirm: () => rejectReviewTask(detailTask.id),
                          };

                          if (isAnyReviewColumnStatus(detailTask.status)) {
                            const agentActive = isAgentReviewStatus(detailTask.status);
                            const humanActive = isHumanReviewStatus(detailTask.status);
                            return (
                              <Stack gap={12}>
                                <ReviewPanel
                                  {...sharedReviewPanelProps}
                                  reviewStage="agent"
                                  stageActive={agentActive}
                                />
                                <ReviewPanel
                                  {...sharedReviewPanelProps}
                                  reviewStage="human"
                                  stageActive={humanActive}
                                />
                              </Stack>
                            );
                          }

                          return <ReviewPanel {...sharedReviewPanelProps} />;
                        })()}
                      </ResizableDetailSection>
                    </>
                  ) : null}
                      </>
                    );
                  })()}
                </Stack>

                {isPipelineStartStatus(detailTask.status) ||
                detailTask.status === "Refinement" ||
                detailTask.status === "Ready" ? (
                  <WorkflowPipelinePanel
                    task={detailTask}
                    theme={theme}
                    onStartPipelineAgent={(kind) => void startPipelineAgent(detailTask, kind)}
                    pipelineFeedback={
                      pipelineAgentFeedback?.taskId === detailTask.id
                        ? pipelineAgentFeedback.message
                        : null
                    }
                  />
                ) : null}

                {detailTask.status === "In Progress" ? (
                  <Stack
                    gap={8}
                    style={{
                      border: `1px solid ${theme.stroke.primary}`,
                      borderRadius: 8,
                      padding: 12,
                      background: theme.fill.secondary,
                    }}
                  >
                    <Row gap={8} align="center">
                      <InProgressActivityIndicator
                        theme={theme}
                        variant={taskNeedsAgentRerun(detailTask) ? "agent" : "active"}
                        size={14}
                        label="Agent forventes"
                      />
                      <Text weight="semibold">
                        {taskNeedsAgentRerun(detailTask)
                          ? "Agent genkørsel påkrævet"
                          : "Agent forventes"}
                      </Text>
                    </Row>
                    <Stack gap={6}>
                      <Text size="small" tone="secondary">
                        {taskNeedsAgentRerun(detailTask)
                          ? "Human Review afvist. Agenten genkører forfra og flytter sagen til Agent Review, derefter Human Review når rettelserne er færdige."
                          : "Agent bygger — afslut med leverance → Agent Review. Ved flyt til I gang åbnes Cursor-agent-chat automatisk (newComposerChat)."}
                      </Text>
                      {getInProgressAgentHint(detailTask) ? (
                        <Text size="small" weight="semibold">
                          {getInProgressAgentHint(detailTask)}
                        </Text>
                      ) : null}
                      {taskNeedsAgentRerun(detailTask) ? (
                        <Text size="small">{getAgentRerunReason(detailTask)}</Text>
                      ) : null}
                      {taskNeedsAgentRerun(detailTask) &&
                      getTaskReviewRejectAttachments(detailTask).length > 0 ? (
                        <ReviewRejectAttachmentsDisplay
                          attachments={getTaskReviewRejectAttachments(detailTask)}
                          theme={theme}
                        />
                      ) : null}
                      {agentRerunFeedback?.taskId === detailTask.id ? (
                        <Text size="small" weight="semibold">
                          {agentRerunFeedback.message}
                        </Text>
                      ) : null}
                      <Row gap={6} wrap>
                        <Button
                          variant="secondary"
                          onClick={() => void startInProgressAgent(detailTask)}
                        >
                          {taskNeedsAgentRerun(detailTask)
                            ? "Start Cursor-agent (genkørsel)"
                            : "Start Cursor-agent"}
                        </Button>
                      </Row>
                    </Stack>
                    <Text size="small" tone="tertiary">
                      Agenten udfylder agentPlan, review-kassen og flytter til Agent Review, derefter Human Review i{" "}
                      <Text as="span" size="small" weight="semibold">
                        {WORKBOARD_DATA_JSON}
                      </Text>
                      .
                    </Text>
                  </Stack>
                ) : null}
                <div
                  style={{
                    borderTop: `1px solid ${theme.stroke.primary}`,
                    paddingTop: 12,
                  }}
                >
                  <Text
                    size="small"
                    tone="tertiary"
                    style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
                  >
                    Sag & stamdata
                  </Text>
                </div>

                <Row gap={8} align="center">
                  <Text size="small" tone="secondary">
                    Nummer
                  </Text>
                  <TextInput
                    value={String(detailTask.number)}
                    onChange={(value) => {
                      const parsed = Number(value.replace(/\D/g, ""));
                      if (!Number.isFinite(parsed)) return;
                      updateTask(detailTask.id, { number: parsed });
                    }}
                    style={{ width: 72 }}
                  />
                </Row>
                <TextInput
                  value={detailTask.title}
                  onChange={(value) => updateTask(detailTask.id, { title: value })}
                />
                <Row gap={8} align="center" wrap>
                  <ThemedPicker
                    pickerId="detail-parent"
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    value={detailTask.parentId ?? ""}
                    onChange={(value) =>
                      updateTask(detailTask.id, {
                        parentId: value ? value : undefined,
                      })
                    }
                    options={[
                      { value: "", label: "Hovedsag (ingen overordnet)" },
                      ...rootTasks
                        .filter((task) => task.id !== detailTask.id)
                        .sort((a, b) => a.number - b.number)
                        .map((task) => ({
                          value: task.id,
                          label: `#${formatTaskNumber(task)} ${task.title}`,
                        })),
                    ]}
                    theme={theme}
                    compact
                    panelMinWidth={320}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setNewTaskDraft({
                        title: "",
                        description: "",
                        status: detailTask.status,
                        priority: detailTask.priority,
                        owner: "",
                        tags: "",
                        parentId: detailTask.id,
                      });
                      setChildrenPanelParentId(detailTask.id);
                    }}
                    style={{ padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
                  >
                    Opret underopgave
                  </Button>
                </Row>
                {getChildTasks(hydratedTasks, detailTask.id).length > 0 ? (
                  <Stack gap={4}>
                    <Text size="small" tone="secondary">
                      Underopgaver
                    </Text>
                    {getChildTasks(hydratedTasks, detailTask.id).map((child) => (
                      <Button
                        key={child.id}
                        variant="ghost"
                        onClick={() => openTask(child.id)}
                        style={{ padding: "4px 10px", fontSize: 12, alignSelf: "flex-start" }}
                      >
                        #{formatTaskNumber(child)} {child.title}
                      </Button>
                    ))}
                  </Stack>
                ) : null}

                <Stack gap={6}>
                  <Button
                    variant="ghost"
                    onClick={() => toggleDescriptionEdit(detailTask)}
                  >
                    {detailDescriptionEditOpen
                      ? "Skjul redigering af beskrivelse"
                      : "Rediger fuld beskrivelse (inkl. spec)"}
                  </Button>
                  {detailDescriptionEditOpen ? (
                    <>
                      <TextArea
                        rows={14}
                        value={detailTask.description}
                        onChange={(value) => updateTask(detailTask.id, { description: value })}
                      />
                      <Row gap={8} align="center" wrap>
                        <Button
                          variant="primary"
                          onClick={() => persistDescriptionDraft(detailTask.id)}
                        >
                          Gem beskrivelse
                        </Button>
                      </Row>
                      <CollapsibleVersionHistory
                        entries={detailTask.fieldHistory?.description ?? []}
                        theme={theme}
                      />
                    </>
                  ) : null}
                </Stack>

                <Row gap={8} align="start">
                  <ThemedPicker
                    pickerId="detail-priority"
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    value={detailTask.priority}
                    onChange={(value) =>
                      updateTask(detailTask.id, { priority: value as Priority })
                    }
                    options={[
                      { value: "P0", label: "P0" },
                      { value: "P1", label: "P1" },
                      { value: "P2", label: "P2" },
                      { value: "P3", label: "P3" },
                    ]}
                    theme={theme}
                    style={{ width: 90 }}
                  />
                  <ThemedPicker
                    pickerId="detail-status"
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    value={detailTask.status}
                    onChange={(value) =>
                      updateTask(detailTask.id, { status: value as Status })
                    }
                    options={statusPickerOptions(columnLabels)}
                    theme={theme}
                    style={{ width: 170 }}
                    panelMinWidth={200}
                    panelMaxHeight={STATUS_PICKER_PANEL_MAX_HEIGHT}
                  />
                  <TextInput
                    value={detailTask.owner}
                    onChange={(value) => updateTask(detailTask.id, { owner: value })}
                    placeholder="Owner"
                    style={{ flex: 1 }}
                  />
                </Row>
                <TextInput
                  value={detailTask.tags}
                  onChange={(value) => updateTask(detailTask.id, { tags: value })}
                  placeholder="tags,kommasepareret"
                />
                <Text size="small" tone="tertiary">
                  Kilde: {detailTask.source}
                </Text>

                {detailTask.status === "In Progress" ? (
                  <ReviewPrepPanel
                    task={detailTask}
                    theme={theme}
                    draft={getReviewPrepDraftForTask(detailTask)}
                    onDraftChange={(next) => {
                      pendingReviewPrepDrafts.set(detailTask.id, next);
                      setReviewPrepDrafts((prev) => ({
                        ...prev,
                        [detailTask.id]: next,
                      }));
                      scheduleReviewPrepAutoSave(detailTask.id, next);
                    }}
                    onStartAgent={() => void runReviewPrepAgent(detailTask)}
                    onRequestReview={() => requestMoveToReview(detailTask.id)}
                    agentFeedback={
                      reviewPrepFeedback?.taskId === detailTask.id
                        ? reviewPrepFeedback.message
                        : null
                    }
                    prepReady={hasReviewPrepReady(
                      detailTask,
                      getReviewPrepDraftForTask(detailTask).summary,
                    )}
                    autoSaveStatus={getAutoSaveStatus(detailTask.id, "prep")}
                  />
                ) : null}

                {(!isAnyReviewColumnStatus(detailTask.status) &&
                  (detailTask.agentReviewEvidence ||
                    detailTask.status === "Done")) ? (
                  <AgentReviewEvidencePanel
                    task={detailTask}
                    theme={theme}
                    verificationGate={getAgentReviewVerificationGate(detailTask)}
                    onStartAgentReview={
                      isAgentReviewStatus(detailTask.status)
                        ? () => void startAgentReviewAgent(detailTask)
                        : undefined
                    }
                    agentReviewFeedback={
                      agentReviewFeedback?.taskId === detailTask.id
                        ? agentReviewFeedback.message
                        : null
                    }
                  />
                ) : null}

                {isAnyReviewColumnStatus(detailTask.status) ||
                detailTask.status === "Done" ||
                detailTask.reviewPlaywrightEvidence ? (
                  <ReviewPlaywrightEvidencePanel
                    task={detailTask}
                    theme={theme}
                    onCopyPipelineCommand={() => void copyPlaywrightPipelineCommand(detailTask)}
                    pipelineCopyFeedback={
                      playwrightCopyFeedback?.taskId === detailTask.id
                        ? playwrightCopyFeedback.message
                        : null
                    }
                  />
                ) : null}

                <TaskActivityLogPanel task={detailTask} theme={theme} />

                <Row gap={8}>
                  <Button
                    variant="secondary"
                    onClick={() => closeDetailPanel()}
                  >
                    Tilbage til board
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => deleteTask(detailTask.id)}
                  >
                    Slet opgave
                  </Button>
                </Row>
              </Stack>
            </CardBody>
          </Card>
          </div>
        </div>
      ) : null}

      {newTaskDraft ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 220,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: 20,
            overflowY: "auto",
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setNewTaskDraft(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
          <Card
            style={{
              width: 680,
              maxWidth: "95%",
              borderColor: theme.stroke.primary,
            }}
          >
            <CardHeader trailing="Ny opgave">
              Opret ny sag
            </CardHeader>
            <CardBody>
              <Stack gap={10}>
                <TextInput
                  value={newTaskDraft.title}
                  onChange={(value) =>
                    setNewTaskDraft((prev) => (prev ? { ...prev, title: value } : prev))
                  }
                  placeholder="Titel"
                />
                <TextArea
                  rows={10}
                  value={newTaskDraft.description}
                  onChange={(value) =>
                    setNewTaskDraft((prev) => (prev ? { ...prev, description: value } : prev))
                  }
                  placeholder="Beskrivelse"
                />
                <Row gap={8} align="start">
                  <ThemedPicker
                    pickerId="new-task-priority"
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    value={newTaskDraft.priority}
                    onChange={(value) =>
                      setNewTaskDraft((prev) =>
                        prev ? { ...prev, priority: value as Priority } : prev,
                      )
                    }
                    options={[
                      { value: "P0", label: "P0" },
                      { value: "P1", label: "P1" },
                      { value: "P2", label: "P2" },
                      { value: "P3", label: "P3" },
                    ]}
                    theme={theme}
                    style={{ width: 90 }}
                  />
                  <ThemedPicker
                    pickerId="new-task-status"
                    openPickerId={openPickerId}
                    setOpenPickerId={setOpenPickerId}
                    value={newTaskDraft.status}
                    onChange={(value) =>
                      setNewTaskDraft((prev) => (prev ? { ...prev, status: value as Status } : prev))
                    }
                    options={statusPickerOptions(columnLabels)}
                    theme={theme}
                    style={{ width: 170 }}
                    panelMinWidth={200}
                    panelMaxHeight={STATUS_PICKER_PANEL_MAX_HEIGHT}
                  />
                  <TextInput
                    value={newTaskDraft.owner}
                    onChange={(value) =>
                      setNewTaskDraft((prev) => (prev ? { ...prev, owner: value } : prev))
                    }
                    placeholder="Owner"
                    style={{ flex: 1 }}
                  />
                </Row>
                <TextInput
                  value={newTaskDraft.tags}
                  onChange={(value) =>
                    setNewTaskDraft((prev) => (prev ? { ...prev, tags: value } : prev))
                  }
                  placeholder="tags,kommasepareret"
                />
                <Row gap={8}>
                  <Button variant="secondary" onClick={() => setNewTaskDraft(null)}>
                    Luk uden at oprette
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => createTaskFromDraft()}
                    disabled={!newTaskDraft.title.trim()}
                  >
                    Opret sag
                  </Button>
                </Row>
              </Stack>
            </CardBody>
          </Card>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 400,
            border: `1px solid ${theme.stroke.primary}`,
            borderRadius: 10,
            background: theme.bg.elevated,
            padding: "10px 12px",
          }}
        >
          <Row gap={10} align="center" justify="space-between">
            <Text>{toast.message}</Text>
            <Row gap={8}>
              {toast.undo ? (
                <Button variant="secondary" onClick={() => runUndo(toast.undo as ToastUndo)}>
                  Fortryd
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setToast(null)}>
                Luk
              </Button>
            </Row>
          </Row>
        </div>
      ) : null}
    </Stack>
  );
}
