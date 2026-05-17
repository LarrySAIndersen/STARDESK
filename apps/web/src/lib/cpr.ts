/** Danish CPR: DDMMYY + optional separator + 4 digits */
const CPR_REGEX = /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])\d{2}[- ]?\d{4}$/;

const CPR_IN_TEXT =
  /(?<!\d)(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])\d{2}[-\s]?\d{4}(?!\d)/;

export function textContainsCpr(text: string): boolean {
  return CPR_IN_TEXT.test(text);
}

export function validateCprOptional(value: string | undefined): true | string {
  if (!value || !value.trim()) {
    return true;
  }
  if (!CPR_REGEX.test(value.trim())) {
    return "Ugyldigt CPR-nummer (format: DDMMYY-XXXX)";
  }
  return true;
}

export function assertNoCprInFreeText(
  title: string,
  description: string,
): string | true {
  if (textContainsCpr(title)) {
    return "CPR-nummer må ikke stå i titel. Brug feltet CPR-nummer.";
  }
  if (textContainsCpr(description)) {
    return "CPR-nummer må ikke stå i beskrivelsen. Brug feltet CPR-nummer.";
  }
  return true;
}
