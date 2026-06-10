import { describe, expect, it } from "vitest";

import {
  buildKp2ZodSchema,
  isKp2FieldVisible,
  kp2DefaultValues,
} from "@/lib/kundeportal-2/form-zod";
import type { Kp2FormSchema } from "@/lib/kundeportal-2/types";

const testSchema: Kp2FormSchema = {
  id: "test-form",
  title: "Testformular",
  category: "generelt",
  icon: "file",
  helpText: "Hjælp",
  fields: [
    { name: "titel", label: "Titel", type: "text", required: true },
    {
      name: "beskrivelse",
      label: "Beskrivelse",
      type: "textarea",
      required: true,
    },
    { name: "gdpr_bekraeftelse", label: "GDPR", type: "checkbox", required: true },
    {
      name: "miljo",
      label: "Miljø",
      type: "select",
      required: false,
      showWhen: { field: "type", values: ["speciel"] },
    },
    { name: "tags", label: "Tags", type: "tags", required: false },
  ],
};

describe("kp2DefaultValues", () => {
  it("initializes checkboxes to false and text fields to empty string", () => {
    expect(kp2DefaultValues(testSchema)).toEqual({
      titel: "",
      beskrivelse: "",
      gdpr_bekraeftelse: false,
      miljo: "",
      tags: "",
    });
  });
});

describe("isKp2FieldVisible", () => {
  it("shows fields without showWhen unconditionally", () => {
    expect(isKp2FieldVisible(testSchema.fields[0], {})).toBe(true);
  });

  it("hides conditional fields when trigger value does not match", () => {
    const conditional = testSchema.fields[3];
    expect(isKp2FieldVisible(conditional, { type: "normal" })).toBe(false);
    expect(isKp2FieldVisible(conditional, { type: "speciel" })).toBe(true);
  });
});

describe("buildKp2ZodSchema", () => {
  const schema = buildKp2ZodSchema(testSchema);

  it("rejects missing required text field", () => {
    const result = schema.safeParse({
      titel: "",
      beskrivelse: "Lang nok beskrivelse her",
      gdpr_bekraeftelse: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects textarea shorter than 10 characters", () => {
    const result = schema.safeParse({
      titel: "Min titel",
      beskrivelse: "kort",
      gdpr_bekraeftelse: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires GDPR checkbox to be checked", () => {
    const result = schema.safeParse({
      titel: "Min titel",
      beskrivelse: "Lang nok beskrivelse her",
      gdpr_bekraeftelse: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid payload", () => {
    const result = schema.safeParse({
      titel: "Min titel",
      beskrivelse: "Lang nok beskrivelse her",
      gdpr_bekraeftelse: true,
      tags: "foo, bar",
    });
    expect(result.success).toBe(true);
  });
});
