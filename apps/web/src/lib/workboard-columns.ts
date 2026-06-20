import type { WorkboardTask } from "@/types/workboard";

export const WORKBOARD_LATER_STATUSES = new Set([
  "Bobler",
  "Backlog",
  "Refinement",
  "Ready",
]);

export const WORKBOARD_ACTIVE_STATUSES = new Set([
  "In Progress",
  "Review",
  "Human Review",
]);

export const WORKBOARD_DONE_STATUSES = new Set(["Done", "Archived"]);

export type WorkboardColumnId = "later" | "active" | "done";

export function workboardColumnForStatus(status: string): WorkboardColumnId {
  if (WORKBOARD_ACTIVE_STATUSES.has(status)) {
    return "active";
  }
  if (WORKBOARD_DONE_STATUSES.has(status)) {
    return "done";
  }
  return "later";
}

export function groupWorkboardTasks(tasks: WorkboardTask[]): Record<WorkboardColumnId, WorkboardTask[]> {
  const grouped: Record<WorkboardColumnId, WorkboardTask[]> = {
    later: [],
    active: [],
    done: [],
  };
  for (const task of tasks) {
    grouped[workboardColumnForStatus(task.status)].push(task);
  }
  for (const column of Object.keys(grouped) as WorkboardColumnId[]) {
    grouped[column].sort((a, b) => a.number - b.number);
  }
  return grouped;
}
