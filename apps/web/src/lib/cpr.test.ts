import { describe, expect, it } from "vitest";

import {
  assertNoCprInFreeText,
  textContainsCpr,
  validateCprOptional,
} from "./cpr";

describe("validateCprOptional", () => {
  it("accepts empty value", () => {
    expect(validateCprOptional("")).toBe(true);
    expect(validateCprOptional(undefined)).toBe(true);
  });

  it("accepts valid CPR formats", () => {
    expect(validateCprOptional("010190-1234")).toBe(true);
    expect(validateCprOptional("010190 1234")).toBe(true);
    expect(validateCprOptional("0101901234")).toBe(true);
  });

  it("rejects invalid CPR", () => {
    expect(validateCprOptional("123")).toMatch(/Ugyldigt CPR/);
  });
});

describe("textContainsCpr", () => {
  it("detects CPR embedded in free text", () => {
    expect(textContainsCpr("Kontakt mig på 010190-1234")).toBe(true);
    expect(textContainsCpr("Ingen persondata her")).toBe(false);
  });
});

describe("assertNoCprInFreeText", () => {
  it("blocks CPR in title or description", () => {
    expect(assertNoCprInFreeText("CPR 010190-1234", "")).toMatch(/titel/);
    expect(assertNoCprInFreeText("Titel", "Min CPR er 010190-1234")).toMatch(/beskrivelsen/);
    expect(assertNoCprInFreeText("Titel", "Beskrivelse uden CPR")).toBe(true);
  });
});
