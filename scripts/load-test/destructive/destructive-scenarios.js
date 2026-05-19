import http from "k6/http";
import { check, fail, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Rate } from "k6/metrics";

const unexpected5xxRate = new Rate("destructive_unexpected_5xx");
const expectedRejectionRate = new Rate("destructive_expected_rejections");
const loginFailures = new Counter("destructive_login_failures");

const baseUrl = String(__ENV.BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const allowDestructive = __ENV.ALLOW_DESTRUCTIVE === "1";
const loginPath = __ENV.LOGIN_PATH || "/api/v1/auth/login";
const ticketsPath = __ENV.TICKETS_PATH || "/api/v1/tickets";
const dashboardPath = __ENV.DASHBOARD_PATH || "/api/v1/reports/dashboard";
const healthPath = __ENV.HEALTH_PATH || "/health";

function isLikelyProductionTarget(url) {
  const hostname = String(url).replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  return !["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
}

if (isLikelyProductionTarget(baseUrl) && !allowDestructive) {
  fail("Refusing destructive test against non-local target. Set ALLOW_DESTRUCTIVE=1 to override.");
}

function parseUsers() {
  if (__ENV.LOAD_TEST_USERS) {
    const parsed = JSON.parse(__ENV.LOAD_TEST_USERS);
    if (!Array.isArray(parsed)) {
      fail("LOAD_TEST_USERS must be a JSON array");
    }
    return parsed;
  }
  const usersFile =
    __ENV.LOAD_TEST_USERS_FILE || "scripts/load-test/load-test-users.json";
  let parsed;
  try {
    parsed = JSON.parse(open(usersFile));
  } catch (_err) {
    parsed = JSON.parse(open("load-test-users.json"));
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail("User pool file must be a non-empty JSON array");
  }
  return parsed;
}

const users = new SharedArray("load-test-users", parseUsers);

function randomUser() {
  return users[Math.floor(Math.random() * users.length)];
}

function login(user) {
  const res = http.post(
    `${baseUrl}${loginPath}`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { "Content-Type": "application/json" }, tags: { endpoint: "auth.login" } }
  );

  const ok = check(res, {
    "login status is 200": (r) => r.status === 200,
    "login includes token": (r) => {
      try {
        return Boolean(r.json("access_token"));
      } catch (_err) {
        return false;
      }
    },
  });
  if (!ok) {
    loginFailures.add(1);
    unexpected5xxRate.add(res.status >= 500);
    return null;
  }
  return res.json("access_token");
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function runReadBurst(token) {
  const responses = http.batch([
    ["GET", `${baseUrl}${healthPath}`, null, { tags: { endpoint: "health" } }],
    ["GET", `${baseUrl}${ticketsPath}`, null, { headers: authHeaders(token), tags: { endpoint: "tickets.list" } }],
    [
      "GET",
      `${baseUrl}${dashboardPath}`,
      null,
      { headers: authHeaders(token), tags: { endpoint: "reports.dashboard" } },
    ],
  ]);

  for (const res of responses) {
    unexpected5xxRate.add(res.status >= 500);
  }
}

export const options = {
  discardResponseBodies: false,
  scenarios: {
    spike: {
      executor: "ramping-vus",
      exec: "spikeScenario",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },
        { duration: "20s", target: 100 },
        { duration: "20s", target: 0 },
      ],
      tags: { scenario: "spike" },
    },
    stress_to_failure: {
      executor: "ramping-vus",
      exec: "stressToFailureScenario",
      startVUs: 10,
      stages: [
        { duration: "30s", target: 40 },
        { duration: "30s", target: 80 },
        { duration: "30s", target: 120 },
        { duration: "30s", target: 180 },
        { duration: "30s", target: 220 },
      ],
      gracefulRampDown: "5s",
      tags: { scenario: "stress-to-failure" },
    },
    auth_flood: {
      executor: "constant-arrival-rate",
      exec: "authFloodScenario",
      rate: 5,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 40,
      maxVUs: 80,
      tags: { scenario: "auth-flood" },
    },
    payload_bomb: {
      executor: "constant-vus",
      exec: "payloadBombScenario",
      vus: 15,
      duration: "30s",
      tags: { scenario: "payload-bomb" },
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],
    http_req_duration: ["p(95)<10000"],
    destructive_unexpected_5xx: ["rate<0.02"],
    destructive_expected_rejections: ["rate>0.85"],
  },
};

export function spikeScenario() {
  const token = login(randomUser());
  if (!token) return;
  runReadBurst(token);
  sleep(0.2);
}

export function stressToFailureScenario() {
  const token = login(randomUser());
  if (!token) return;
  runReadBurst(token);
  sleep(0.1);
}

export function authFloodScenario() {
  const badEmail = __ENV.BAD_LOGIN_EMAIL || "invalid@example.dk";
  const badPassword = __ENV.BAD_LOGIN_PASSWORD || "totally-wrong-password";

  const requests = [];
  for (let i = 0; i < 20; i += 1) {
    requests.push([
      "POST",
      `${baseUrl}${loginPath}`,
      JSON.stringify({ email: badEmail, password: badPassword }),
      { headers: { "Content-Type": "application/json" }, tags: { endpoint: "auth.bad_login" } },
    ]);
  }
  for (let i = 0; i < 20; i += 1) {
    const user = randomUser();
    requests.push([
      "POST",
      `${baseUrl}${loginPath}`,
      JSON.stringify({ email: user.email, password: user.password }),
      { headers: { "Content-Type": "application/json" }, tags: { endpoint: "auth.good_login" } },
    ]);
  }

  const responses = http.batch(requests);
  const goodResponses = responses.slice(20);
  const badResponses = responses.slice(0, 20);

  check(goodResponses, {
    "good logins avoid 5xx": (rs) => rs.every((r) => r.status < 500),
  });
  check(badResponses, {
    "bad logins rejected": (rs) => rs.every((r) => [401, 429].includes(r.status)),
  });

  for (const res of responses) {
    unexpected5xxRate.add(res.status >= 500);
  }
}

export function payloadBombScenario() {
  const token = login(randomUser());
  if (!token) return;

  const oversizedTitle = `bomb-${"x".repeat(2000)}`;
  const oversizedDescription = `desc-${"y".repeat(100000)}`;
  const payload = {
    ticket_type: "incident",
    title: oversizedTitle,
    description: oversizedDescription,
    priority: "high",
    gdpr_consent: false,
  };

  const response = http.post(`${baseUrl}${ticketsPath}`, JSON.stringify(payload), {
    headers: authHeaders(token),
    tags: { endpoint: "tickets.create.payload_bomb" },
  });

  expectedRejectionRate.add([400, 413, 415, 422].includes(response.status));
  unexpected5xxRate.add(response.status >= 500);

  check(response, {
    "payload bomb rejected gracefully": (r) => [400, 413, 415, 422].includes(r.status),
  });
}
