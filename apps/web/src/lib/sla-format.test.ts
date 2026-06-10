import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeRemainingSeconds,
  formatSlaCountdownValue,
  formatSlaDuration,
  slaCountdownLabel,
} from "./sla-format";

describe("formatSlaDuration", () => {
  it("formats multi-day durations", () => {
    expect(formatSlaDuration(90061)).toBe("1d 1t 1m");
  });

  it("includes seconds for sub-hour durations", () => {
    expect(formatSlaDuration(125)).toBe("2m 5s");
  });

  it("uses absolute value for negative seconds", () => {
    expect(formatSlaDuration(-125)).toBe("2m 5s");
  });
});

describe("slaCountdownLabel", () => {
  it("shows closed message for resolved tickets", () => {
    expect(slaCountdownLabel(3600, false, "resolved")).toBe("SLA afsluttet");
  });

  it("shows dash when remaining is unknown", () => {
    expect(slaCountdownLabel(null, false, "in_progress")).toBe("—");
  });

  it("shows breach message when SLA is exceeded", () => {
    expect(slaCountdownLabel(-60, false, "in_progress")).toBe("SLA overskredet");
    expect(slaCountdownLabel(60, true, "in_progress")).toBe("SLA overskredet");
  });

  it("shows remaining label for active SLA", () => {
    expect(slaCountdownLabel(3600, false, "in_progress")).toBe("SLA tid tilbage");
  });
});

describe("formatSlaCountdownValue", () => {
  it("appends overskredet for breached SLA", () => {
    expect(formatSlaCountdownValue(-125, true)).toBe("2m 5s overskredet");
  });

  it("returns duration only when not breached", () => {
    expect(formatSlaCountdownValue(125, false)).toBe("2m 5s");
  });
});

describe("computeRemainingSeconds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives remaining seconds from resolution_due_at", () => {
    const dueAt = "2026-06-10T12:30:00.000Z";
    expect(computeRemainingSeconds(dueAt, null)).toBe(1800);
  });

  it("falls back to server remaining seconds when due is missing", () => {
    expect(computeRemainingSeconds(null, 900)).toBe(900);
  });

  it("returns null when neither due nor server value is present", () => {
    expect(computeRemainingSeconds(undefined, undefined)).toBeNull();
  });
});
