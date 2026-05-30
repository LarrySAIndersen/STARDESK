/**
 * Work Board API helpers for CI / headless scripts (export + canvas upsert).
 */

export function resolveApiConfig() {
  const apiUrl = (process.env.STARDESK_API_URL || "").replace(/\/$/, "");
  const token = process.env.STARDESK_API_TOKEN || "";
  return { apiUrl, token };
}

export function requireApiConfig() {
  const { apiUrl, token } = resolveApiConfig();
  if (!apiUrl || !token) {
    throw new Error("Set STARDESK_API_URL and STARDESK_API_TOKEN.");
  }
  return { apiUrl, token };
}

export async function fetchTasksFromApi() {
  const { apiUrl, token } = requireApiConfig();
  const res = await fetch(`${apiUrl}/api/v1/workboard/tasks/export`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`API export failed (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  return Array.isArray(body.tasks) ? body.tasks : body;
}

export async function pushTaskToApi(task) {
  const { apiUrl, token } = requireApiConfig();
  const canvasId = task.id;
  if (!canvasId) throw new Error("Task missing canvas id.");
  const res = await fetch(`${apiUrl}/api/v1/workboard/tasks/${encodeURIComponent(canvasId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(task),
  });
  if (!res.ok) {
    throw new Error(`API upsert failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}
