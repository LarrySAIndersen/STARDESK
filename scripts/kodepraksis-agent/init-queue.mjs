#!/usr/bin/env node
/**
 * Initialize or refresh kodepraksis queue from plan (preserves done/partial status).
 */
import { EXEC_ORDER, PLAN_ITEMS } from "./kodepraksis-plan.mjs";
import { appendLog, readQueue, writeQueue, QUEUE_PATH } from "./queue-io.mjs";

const existing = readQueue();
const byN = new Map((existing?.items ?? []).map((i) => [i.n, i]));

const items = EXEC_ORDER.map((n) => {
  const prev = byN.get(n);
  return {
    n,
    status: prev?.status ?? "open",
    attempts: prev?.attempts ?? 0,
    lastFallback: prev?.lastFallback ?? null,
    notes: prev?.notes ?? null,
    prUrl: prev?.prUrl ?? null,
    completedAt: prev?.completedAt ?? null,
  };
});

const queue = {
  version: "1",
  source: "workboard/constitution/STARDESK-kodepraksis-50.md",
  updatedAt: new Date().toISOString(),
  currentN: existing?.currentN ?? null,
  items,
  activityLog: existing?.activityLog ?? [],
};

appendLog(queue, `init-queue: ${PLAN_ITEMS.length} items, order ${EXEC_ORDER.join(",")}`);
writeQueue(queue);
console.log(`Wrote ${QUEUE_PATH} (${items.length} items)`);
