import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "pk_session";

function secret(): string {
  const value = process.env.PROJECT_KANBAN_SECRET;
  if (!value || value.length < 16) {
    throw new Error("PROJECT_KANBAN_SECRET must be set (min 16 chars)");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(email: string): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = `${email}|${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return false;
  }
  try {
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const expected = sign(payload);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
    const [, expRaw] = payload.split("|");
    const exp = Number(expRaw);
    return Number.isFinite(exp) && exp > Date.now();
  } catch {
    return false;
  }
}

export function verifyCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.PROJECT_KANBAN_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.PROJECT_KANBAN_PASSWORD;
  if (!expectedEmail || !expectedPassword) {
    return false;
  }
  return (
    email.trim().toLowerCase() === expectedEmail && password === expectedPassword
  );
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
