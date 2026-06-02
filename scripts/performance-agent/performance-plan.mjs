/**
 * Maps STARDESK-performance-50 plan items to measurable scenarios.
 * Source: workboard/constitution/STARDESK-performance-50.md
 */

/** @typedef {{ id: string; method: string; path: string; label: string; planItems: number[]; critical?: boolean }} ApiEndpoint */
/** @typedef {{ id: string; webPath: string; label: string; planItems: number[]; waitFor?: string }} UiScenario */

/** API endpoints aligned with KRITISK/HØJ plan items. */
export const API_ENDPOINTS = [
  {
    id: "health",
    method: "GET",
    path: "/health",
    label: "Health probe",
    planItems: [50],
  },
  {
    id: "login",
    method: "POST",
    path: "/api/v1/auth/login",
    label: "Auth login",
    planItems: [9],
  },
  {
    id: "tickets-list",
    method: "GET",
    path: "/api/v1/tickets",
    label: "Ticket list (N+1 / selectinload candidate)",
    planItems: [1, 5, 13, 14],
    critical: true,
  },
  {
    id: "ticket-detail",
    method: "GET",
    path: "/api/v1/tickets/{id}",
    label: "Ticket detail (relationship eager-load candidate)",
    planItems: [1, 5],
    critical: true,
  },
  {
    id: "dashboard",
    method: "GET",
    path: "/api/v1/reports/dashboard",
    label: "Dashboard report",
    planItems: [31],
  },
  {
    id: "categories",
    method: "GET",
    path: "/api/v1/categories",
    label: "Categories (cache candidate)",
    planItems: [6],
    critical: true,
  },
  {
    id: "kanban-boards",
    method: "GET",
    path: "/api/v1/kanban/boards",
    label: "Kanban board list",
    planItems: [25],
  },
  {
    id: "kanban-board-detail",
    method: "GET",
    path: "/api/v1/kanban/boards/{id}",
    label: "Kanban board detail",
    planItems: [1, 25],
    critical: true,
  },
];

/** UI routes for Playwright perf agent — maps to frontend plan items. */
export const UI_SCENARIOS = [
  {
    id: "tickets-list",
    webPath: "/tickets",
    label: "Alle sager",
    planItems: [1, 13, 19],
    waitFor: "Alle sager",
  },
  {
    id: "ticket-detail",
    webPath: "/tickets",
    label: "Sag-detalje (first row)",
    planItems: [1, 19],
    waitFor: "Alle sager",
    followFirstTicket: true,
  },
  {
    id: "kanban",
    webPath: "/kanban",
    label: "Kanban board",
    planItems: [16, 25],
    waitFor: "Kanban",
  },
  {
    id: "dashboard",
    webPath: "/dashboard",
    label: "Dashboard",
    planItems: [19, 31],
    waitFor: "Dashboard",
  },
  {
    id: "admin-categories",
    webPath: "/admin/categories",
    label: "Admin kategorier",
    planItems: [6, 16],
    waitFor: "Kategorier",
  },
];

/** Default P95 latency targets (ms) per endpoint/scenario — item 50 baseline. */
export const DEFAULT_THRESHOLDS = {
  api: {
    health: 500,
    login: 1500,
    "tickets-list": 2000,
    "ticket-detail": 2000,
    dashboard: 2500,
    categories: 800,
    "kanban-boards": 1500,
    "kanban-board-detail": 2500,
    default: 2000,
  },
  ui: {
    "tickets-list": 4000,
    "ticket-detail": 4500,
    kanban: 5000,
    dashboard: 4500,
    "admin-categories": 5000,
    default: 5000,
    lcpMs: 3500,
    cls: 0.1,
  },
  global: {
    p95Ms: 2000,
    errorRatePct: 1,
  },
};

/** All 50 plan items with measurement status for canvas/report. */
export const PLAN_ITEMS = [
  { n: 1, title: "Nul eager-loading", tier: "KRITISK", measurable: true, agent: "jmeter" },
  { n: 2, title: "N+1 bulk delete teams.py", tier: "KRITISK", measurable: false, agent: "code" },
  { n: 3, title: "N+1 category_admin.py", tier: "KRITISK", measurable: false, agent: "code" },
  { n: 4, title: "N+1 org_access.py", tier: "KRITISK", measurable: false, agent: "code" },
  { n: 5, title: "Central ticket repository", tier: "KRITISK", measurable: true, agent: "jmeter" },
  { n: 6, title: "Ingen caching-lag", tier: "KRITISK", measurable: true, agent: "jmeter" },
  { n: 7, title: "BaseHTTPMiddleware buffer", tier: "KRITISK", measurable: true, agent: "jmeter" },
  { n: 8, title: "pool_recycle aggressivt", tier: "KRITISK", measurable: false, agent: "config" },
  { n: 9, title: "pool_size serverless", tier: "KRITISK", measurable: false, agent: "config" },
  { n: 10, title: "response_model serializer", tier: "KRITISK", measurable: true, agent: "jmeter" },
  { n: 11, title: "100 commit/flush-kald", tier: "HØJ", measurable: false, agent: "code" },
  { n: 12, title: "tickets.py import overhead", tier: "HØJ", measurable: false, agent: "code" },
  { n: 13, title: "Ticket list SELECT begrænsning", tier: "HØJ", measurable: true, agent: "jmeter" },
  { n: 14, title: "57 ORDER BY indexes", tier: "HØJ", measurable: true, agent: "jmeter" },
  { n: 15, title: "Query timeout", tier: "HØJ", measurable: false, agent: "config" },
  { n: 16, title: "Frontend dynamic imports", tier: "HØJ", measurable: true, agent: "playwright" },
  { n: 17, title: "fire-and-forget audit", tier: "HØJ", measurable: false, agent: "code" },
  { n: 18, title: "HTTP preload hints", tier: "HØJ", measurable: false, agent: "code" },
  { n: 19, title: "useEffect client-fetch", tier: "HØJ", measurable: true, agent: "playwright" },
  { n: 20, title: "Gmail service request-path", tier: "HØJ", measurable: false, agent: "code" },
  { n: 21, title: "Ticket export memory", tier: "HØJ", measurable: true, agent: "jmeter" },
  { n: 22, title: "sf_chat LLM request-path", tier: "HØJ", measurable: false, agent: "code" },
  { n: 23, title: "pool_pre_ping Neon", tier: "HØJ", measurable: false, agent: "config" },
  { n: 24, title: "gzip/brotli kompression", tier: "HØJ", measurable: true, agent: "jmeter" },
  { n: 25, title: "Kanban query complexity", tier: "HØJ", measurable: true, agent: "both" },
  { n: 26, title: "React.memo store komponenter", tier: "MEDIUM", measurable: true, agent: "playwright" },
  { n: 27, title: "missing key i map()", tier: "MEDIUM", measurable: false, agent: "code" },
  { n: 28, title: "Ticket intelligence LLM", tier: "MEDIUM", measurable: false, agent: "code" },
  { n: 29, title: "Cursor pagination", tier: "MEDIUM", measurable: true, agent: "jmeter" },
  { n: 30, title: "SLA status per-request", tier: "MEDIUM", measurable: true, agent: "jmeter" },
  { n: 31, title: "Dashboard filters indexes", tier: "MEDIUM", measurable: true, agent: "both" },
  { n: 32, title: "Attachment streaming", tier: "MEDIUM", measurable: true, agent: "jmeter" },
  { n: 33, title: "User import batch", tier: "MEDIUM", measurable: false, agent: "code" },
  { n: 34, title: "Suspense boundaries", tier: "MEDIUM", measurable: true, agent: "playwright" },
  { n: 35, title: "next/image thumbnails", tier: "MEDIUM", measurable: true, agent: "playwright" },
  { n: 36, title: "ETags conditional", tier: "MEDIUM", measurable: true, agent: "jmeter" },
  { n: 37, title: "Alembic schema check", tier: "MEDIUM", measurable: false, agent: "config" },
  { n: 38, title: "Backend profiling", tier: "MEDIUM", measurable: false, agent: "config" },
  { n: 39, title: "Bundle tree-shaking", tier: "MEDIUM", measurable: true, agent: "playwright" },
  { n: 40, title: "UUID indexes", tier: "MEDIUM", measurable: false, agent: "code" },
  { n: 41, title: "orjson response", tier: "LAV", measurable: true, agent: "jmeter" },
  { n: 42, title: "FOR UPDATE SKIP LOCKED", tier: "LAV", measurable: false, agent: "code" },
  { n: 43, title: "Pool metrics", tier: "LAV", measurable: false, agent: "config" },
  { n: 44, title: "Prefetch links", tier: "LAV", measurable: true, agent: "playwright" },
  { n: 45, title: "Read replicas", tier: "LAV", measurable: false, agent: "arch" },
  { n: 46, title: "Query result caching", tier: "LAV", measurable: true, agent: "jmeter" },
  { n: 47, title: "Service worker offline", tier: "LAV", measurable: false, agent: "playwright" },
  { n: 48, title: "Batch endpoints", tier: "LAV", measurable: true, agent: "jmeter" },
  { n: 49, title: "Edge caching config", tier: "LAV", measurable: false, agent: "arch" },
  { n: 50, title: "P95 latency targets", tier: "LAV", measurable: true, agent: "both" },
];

export function thresholdForApiEndpoint(endpointId, overrides = {}) {
  const merged = { ...DEFAULT_THRESHOLDS.api, ...overrides };
  return merged[endpointId] ?? merged.default;
}

export function thresholdForUiScenario(scenarioId, overrides = {}) {
  const merged = { ...DEFAULT_THRESHOLDS.ui, ...overrides };
  return merged[scenarioId] ?? merged.default;
}
