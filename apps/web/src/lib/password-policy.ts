/** Min 8 chars; letters (any case) and digits only — no special characters. */
export const PASSWORD_PATTERN = /^[a-zA-Z0-9]{8,}$/;

export const PASSWORD_VALIDATION_MESSAGE =
  "Adgangskoden skal være mindst 8 tegn og må kun indeholde bogstaver og tal";

export function validatePassword(password: string): string | null {
  if (!PASSWORD_PATTERN.test(password)) {
    return PASSWORD_VALIDATION_MESSAGE;
  }
  return null;
}
