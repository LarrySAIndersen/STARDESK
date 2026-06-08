import { z } from "zod";

import type { Kp2FormField, Kp2FormSchema } from "@/lib/kundeportal-2/types";

function zodForField(field: Kp2FormField): z.ZodTypeAny {
  switch (field.type) {
    case "checkbox":
      return field.required
        ? z.boolean().refine((v) => v === true, {
            message: "Du skal bekræfte dette felt",
          })
        : z.boolean().optional();
    case "textarea":
      return field.required
        ? z.string().min(10, `${field.label} skal udfyldes (min. 10 tegn)`)
        : z.string().optional();
    case "tags":
      return z.string().optional();
    default:
      return field.required
        ? z.string().min(1, `${field.label} er påkrævet`)
        : z.string().optional();
  }
}

export function buildKp2ZodSchema(form: Kp2FormSchema) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of form.fields) {
    shape[field.name] = zodForField(field);
  }
  return z.object(shape);
}

export function isKp2FieldVisible(
  field: Kp2FormField,
  values: Record<string, string | boolean | undefined>,
): boolean {
  if (!field.showWhen) return true;
  const current = values[field.showWhen.field];
  if (typeof current !== "string") return false;
  return field.showWhen.values.includes(current);
}

export function kp2DefaultValues(form: Kp2FormSchema): Record<string, string | boolean> {
  const defaults: Record<string, string | boolean> = {};
  for (const field of form.fields) {
    if (field.type === "checkbox") {
      defaults[field.name] = false;
    } else if (field.defaultValue) {
      defaults[field.name] = field.defaultValue;
    } else {
      defaults[field.name] = "";
    }
  }
  return defaults;
}
