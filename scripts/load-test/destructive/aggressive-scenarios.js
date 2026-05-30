import http from "k6/http";
import { check, fail, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Rate } from "k6/metrics";

const unexpected5xxRate = new Rate("aggressive_unexpected_5xx");
const expectedConflictOrValidationRate = new Rate("aggressive_expected_conflict_or_validation");
const authzForbiddenRate = new Rate("aggressive_authz_forbidden");
const authzProbeSkipped = new Counter("aggressive_authz_probe_skipped");

const baseUrl = String(__ENV.BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const allowDestructive = __ENV.ALLOW_DESTRUCTIVE === "1";
const loginPath = __ENV.LOGIN_PATH || "/api/v1/auth/login";
const ticketsPath = __ENV.TICKETS_PATH || "/api/v1/tickets";
const usersPath = __ENV.USERS_PATH || "/api/v1/users";
const teamsPath = __ENV.TEAMS_PATH || "/api/v1/teams";
const writeDuration = __ENV.AGGRESSIVE_WRITE_DURATION || "45s";
const readDuration = __ENV.AGGRESSIVE_READ_DURATION || "30s";
const smokeMode = __ENV.AGGRESSIVE_SMOKE === "1";

function isLikelyProductionTarget(url) {
  const hostname = String(url).replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  return !["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
}

if (isLikelyProductionTarget(baseUrl) && !allowDestructive) {
  fail("Refusing aggressive destructive test against non-local target. Set ALLOW_DESTRUCTIVE=1 to override.");
}

function parseUsers() {
  if (__ENV.LOAD_TEST_USERS) {
    const parsed = JSON.parse(__ENV.LOAD_TEST_USERS);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fail("LOAD_TEST_USERS must be a non-empty JSON array");
    }
    return parsed;
  }

  const usersFile = __ENV.LOAD_TEST_USERS_FILE || "scripts/load-test/load-test-users.json";
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

const users = new SharedArray("aggressive-load-test-users", parseUsers);

function login(user) {
  const response = http.post(
    `${baseUrl}${loginPath}`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { "Content-Type": "application/json" }, tags: { endpoint: "auth.login" } }
  );
  if (response.status !== 200) {
    unexpected5xxRate.add(response.status >= 500);
    return null;
  }
  let body;
  try {
    body = response.json();
  } catch (_err) {
    return null;
  }
  return {
    token: body.access_token || null,
    role: body.user?.role || null,
  };
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getOrCreateTargetTicket(staffToken) {
  const listResponse = http.get(`${baseUrl}${ticketsPath}?limit=1`, {
    headers: authHeaders(staffToken),
    tags: { endpoint: "tickets.list.seed" },
  });
  unexpected5xxRate.add(listResponse.status >= 500);
  if (listResponse.status === 200) {
    try {
      const tickets = listResponse.json();
      if (Array.isArray(tickets) && tickets.length > 0 && tickets[0]?.id) {
        return String(tickets[0].id);
      }
    } catch (_err) {
      // Continue with create fallback.
    }
  }

  const createResponse = http.post(
    `${baseUrl}${ticketsPath}`,
    JSON.stringify({
      ticket_type: "incident",
      title: `aggressive-seed-${Date.now()}`,
      description: "Aggressive destructive seed ticket for concurrent state mutation coverage.",
      priority: "medium",
      gdpr_consent: false,
    }),
    { headers: authHeaders(staffToken), tags: { endpoint: "tickets.create.seed" } }
  );
  unexpected5xxRate.add(createResponse.status >= 500);
  if (createResponse.status !== 201) {
    fail(`Could not resolve target ticket for aggressive suite (status=${createResponse.status})`);
  }
  return String(createResponse.json("id"));
}

function locateEndUser() {
  if (__ENV.END_USER_EMAIL && __ENV.END_USER_PASSWORD) {
    return {
      email: __ENV.END_USER_EMAIL,
      password: __ENV.END_USER_PASSWORD,
      label: "end-user-env",
    };
  }

  for (const user of users) {
    const label = String(user.label || "").toLowerCase();
    const email = String(user.email || "").toLowerCase();
    if (
      label.includes("submitter") ||
      label.includes("end-user") ||
      label.includes("end_user") ||
      email.includes("submitter")
    ) {
      return user;
    }
  }
  return null;
}

export function setup() {
  const staffUser = users[0];
  const staffLogin = login(staffUser);
  if (!staffLogin?.token) {
    fail(`Staff login failed for ${staffUser?.email || "first user"}`);
  }

  const ticketId = __ENV.TARGET_TICKET_ID || getOrCreateTargetTicket(staffLogin.token);
  const endUserCandidate = locateEndUser();
  let endUserToken = null;
  if (endUserCandidate) {
    const endUserLogin = login(endUserCandidate);
    if (endUserLogin?.token && ["submitter", "end_user"].includes(String(endUserLogin.role))) {
      endUserToken = endUserLogin.token;
    }
  }

  return {
    staffToken: staffLogin.token,
    ticketId,
    endUserToken,
  };
}

export const options = {
  discardResponseBodies: false,
  scenarios: {
    "parallel-writes": {
      executor: "constant-vus",
      exec: "parallelWritesScenario",
      vus: smokeMode ? 5 : 10,
      duration: smokeMode ? "15s" : writeDuration,
      tags: { scenario: "parallel-writes" },
    },
    "state-machine": {
      executor: "constant-vus",
      exec: "stateMachineScenario",
      vus: smokeMode ? 5 : 8,
      duration: smokeMode ? "15s" : writeDuration,
      tags: { scenario: "state-machine" },
    },
    "payload-edge": {
      executor: "constant-vus",
      exec: "payloadEdgeScenario",
      vus: smokeMode ? 5 : 6,
      duration: smokeMode ? "15s" : writeDuration,
      tags: { scenario: "payload-edge" },
    },
    "authz-probe": {
      executor: "constant-vus",
      exec: "authzProbeScenario",
      vus: 5,
      duration: smokeMode ? "15s" : writeDuration,
      tags: { scenario: "authz-probe" },
    },
    "burst-read": {
      executor: "constant-vus",
      exec: "burstReadScenario",
      vus: smokeMode ? 5 : 30,
      duration: smokeMode ? "15s" : readDuration,
      tags: { scenario: "burst-read" },
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.12"],
    "http_req_duration{scenario:burst-read}": ["p(95)<2000"],
    aggressive_unexpected_5xx: ["rate<0.02"],
    aggressive_expected_conflict_or_validation: ["rate>0.65"],
    aggressive_authz_forbidden: ["rate>0.98"],
  },
};

function evaluateMutationResponse(response) {
  const acceptedStatuses = [200, 400, 409, 415, 422];
  const expected = acceptedStatuses.includes(response.status);
  expectedConflictOrValidationRate.add([400, 409, 415, 422].includes(response.status));
  unexpected5xxRate.add(response.status >= 500);
  check(response, {
    "mutation gracefully accepted or rejected": () => expected,
    "mutation avoids 5xx": (r) => r.status < 500,
  });
}

export function parallelWritesScenario(data) {
  const headers = authHeaders(data.staffToken);
  const ticketId = data.ticketId;
  const now = Date.now();
  const priority = ["critical", "high", "medium", "low"][Math.floor(Math.random() * 4)];

  const responses = http.batch([
    [
      "PATCH",
      `${baseUrl}${ticketsPath}/${ticketId}/priority`,
      JSON.stringify({
        priority,
        reason: `aggressive-priority-race-${now}-valid-reason`,
      }),
      { headers, tags: { endpoint: "tickets.priority.parallel" } },
    ],
    [
      "PATCH",
      `${baseUrl}${ticketsPath}/${ticketId}`,
      JSON.stringify({ status: "in_progress" }),
      { headers, tags: { endpoint: "tickets.status.parallel" } },
    ],
    [
      "PATCH",
      `${baseUrl}${ticketsPath}/${ticketId}/assignment`,
      JSON.stringify({
        assignment_reason: `aggressive-assignment-race-${now}`,
      }),
      { headers, tags: { endpoint: "tickets.assignment.parallel" } },
    ],
    [
      "POST",
      `${baseUrl}${ticketsPath}/${ticketId}/slack-push`,
      JSON.stringify({ channel_id: "C_MOCK_IT_SUPPORT" }),
      { headers, tags: { endpoint: "tickets.slack_push.parallel" } },
    ],
  ]);

  for (const response of responses) {
    evaluateMutationResponse(response);
  }
  sleep(0.1);
}

export function stateMachineScenario(data) {
  const headers = authHeaders(data.staffToken);
  const ticketId = data.ticketId;
  const transitions = ["closed", "new", "resolved", "in_progress", "closed"];
  const requests = transitions.map((statusValue) => [
    "PATCH",
    `${baseUrl}${ticketsPath}/${ticketId}`,
    JSON.stringify({ status: statusValue }),
    { headers, tags: { endpoint: "tickets.status.transition" } },
  ]);
  const responses = http.batch(requests);
  for (const response of responses) {
    evaluateMutationResponse(response);
  }
  sleep(0.1);
}

export function payloadEdgeScenario(data) {
  const headers = authHeaders(data.staffToken);
  const ticketId = data.ticketId;
  const nested = {};
  let cursor = nested;
  for (let i = 0; i < 40; i += 1) {
    cursor[`level_${i}`] = {};
    cursor = cursor[`level_${i}`];
  }
  cursor.leaf = "deep-value";

  const duplicateKeyPayload =
    '{"ticket_type":"incident","title":"dupe-a","title":"dupe-b","description":"duplicate key payload for parser handling.","priority":"high","gdpr_consent":false}';

  const responses = http.batch([
    [
      "POST",
      `${baseUrl}${ticketsPath}`,
      duplicateKeyPayload,
      { headers, tags: { endpoint: "tickets.create.duplicate_keys" } },
    ],
    [
      "POST",
      `${baseUrl}${ticketsPath}`,
      JSON.stringify({
        ticket_type: "incident",
        title: `nul-byte-\u0000-title-${Date.now()}`,
        description: "unicode and control character edge case for validation hardening.",
        priority: "high",
        gdpr_consent: false,
      }),
      { headers, tags: { endpoint: "tickets.create.control_chars" } },
    ],
    [
      "POST",
      `${baseUrl}${ticketsPath}`,
      JSON.stringify({
        ticket_type: "incident",
        title: `nested-json-${Date.now()}`,
        description: "nested-json-edge-coverage",
        priority: "medium",
        gdpr_consent: false,
        intake_answers: nested,
        tags: [],
      }),
      { headers, tags: { endpoint: "tickets.create.nested_payload" } },
    ],
    [
      "PATCH",
      `${baseUrl}${ticketsPath}/${ticketId}/priority`,
      "priority=critical&reason=wrong-content-type",
      {
        headers: {
          Authorization: `Bearer ${data.staffToken}`,
          "Content-Type": "text/plain",
        },
        tags: { endpoint: "tickets.priority.wrong_content_type" },
      },
    ],
  ]);

  for (const response of responses) {
    evaluateMutationResponse(response);
  }
  sleep(0.2);
}

export function authzProbeScenario(data) {
  if (!data.endUserToken) {
    authzProbeSkipped.add(1);
    sleep(0.5);
    return;
  }

  const headers = authHeaders(data.endUserToken);
  const responses = http.batch([
    ["GET", `${baseUrl}${usersPath}`, null, { headers, tags: { endpoint: "users.authz_probe" } }],
    ["GET", `${baseUrl}${teamsPath}`, null, { headers, tags: { endpoint: "teams.authz_probe" } }],
  ]);

  for (const response of responses) {
    const forbidden = [401, 403].includes(response.status);
    authzForbiddenRate.add(forbidden);
    unexpected5xxRate.add(response.status >= 500);
    check(response, {
      "authz probe denied": () => forbidden,
      "authz probe avoids 5xx": (r) => r.status < 500,
    });
  }
  sleep(0.2);
}

export function burstReadScenario(data) {
  const headers = authHeaders(data.staffToken);
  const ticketDetail = `${baseUrl}${ticketsPath}/${data.ticketId}`;
  const requests = Array.from({ length: 30 }, () => [
    "GET",
    ticketDetail,
    null,
    { headers, tags: { endpoint: "tickets.detail.burst_read" } },
  ]);
  const responses = http.batch(requests);
  for (const response of responses) {
    unexpected5xxRate.add(response.status >= 500);
    check(response, {
      "burst read avoids 5xx": (r) => r.status < 500,
    });
  }
  sleep(0.1);
}
