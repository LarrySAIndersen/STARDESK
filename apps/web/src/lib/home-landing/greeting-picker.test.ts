import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  formatHomeLandingGreeting,
  getTimeSlot,
  pickHomeLandingGreeting,
  type TimeSlot,
} from "./greeting-picker";
import { HOME_LANDING_GREETING_COUNT } from "./greetings";

describe("getTimeSlot", () => {
  it("maps hours to slots", () => {
    expect(getTimeSlot(8)).toBe("morning");
    expect(getTimeSlot(14)).toBe("afternoon");
    expect(getTimeSlot(19)).toBe("evening");
    expect(getTimeSlot(23)).toBe("night");
  });
});

describe("pickHomeLandingGreeting", () => {
  const base = new Date("2026-06-13T10:00:00");

  it("uses third-visit pool on third login", () => {
    const a = pickHomeLandingGreeting({
      displayName: "Anna",
      visitCountToday: 3,
      now: base,
    });
    const b = pickHomeLandingGreeting({
      displayName: "Anna",
      visitCountToday: 3,
      now: base,
    });
    expect(a).toBe(b);
    expect(a).toContain("Anna");
    expect(a.toLowerCase()).toMatch(/tredje|igen|tilbage/);
  });

  it("uses repeat pool on fourth login and beyond", () => {
    const fourth = pickHomeLandingGreeting({
      displayName: "Anna",
      visitCountToday: 4,
      now: base,
    });
    const fifth = pickHomeLandingGreeting({
      displayName: "Anna",
      visitCountToday: 5,
      now: base,
    });
    expect(fourth).toContain("Anna");
    expect(fifth).toContain("Anna");
    expect(fourth).not.toBe(
      pickHomeLandingGreeting({
        displayName: "Anna",
        visitCountToday: 1,
        now: base,
      }),
    );
  });

  it("rotates by day and time", () => {
    const morning = pickHomeLandingGreeting({
      displayName: "Anna",
      visitCountToday: 1,
      now: new Date("2026-06-13T09:00:00"),
    });
    const evening = pickHomeLandingGreeting({
      displayName: "Anna",
      visitCountToday: 1,
      now: new Date("2026-06-13T20:00:00"),
    });
    expect(morning).not.toBe(evening);
  });

  it("has exactly 250 greetings in catalog", () => {
    expect(HOME_LANDING_GREETING_COUNT).toBe(250);
  });
});

describe("formatHomeLandingGreeting", () => {
  it("substitutes name placeholder", () => {
    expect(formatHomeLandingGreeting("Hej, {name}", "Bo")).toBe("Hej, Bo");
  });
});

describe("greetings catalog integrity", () => {
  it("loads 250 unique templates from data file", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(dir, "greetings-data.json"), "utf8");
    const data = JSON.parse(raw) as {
      morning: string[];
      afternoon: string[];
      evening: string[];
      night: string[];
      thirdVisit: string[];
      repeatVisit: string[];
    };
    const all = [
      ...data.morning,
      ...data.afternoon,
      ...data.evening,
      ...data.night,
      ...data.thirdVisit,
      ...data.repeatVisit,
    ];
    expect(all.length).toBe(250);
    expect(new Set(all).size).toBe(250);
    for (const slot of ["morning", "afternoon", "evening", "night"] as const) {
      expect(data[slot].length).toBe(50);
    }
    expect(data.thirdVisit.length).toBe(25);
    expect(data.repeatVisit.length).toBe(25);
  });
});
