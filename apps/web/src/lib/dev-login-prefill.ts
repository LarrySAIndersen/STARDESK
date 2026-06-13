/** Optional dev-only login prefill — set NEXT_PUBLIC_DEV_LOGIN_PREFILL_EMAIL in .env.local only. */

export type DevLoginPrefill = {
  email: string;
  password: string;
};

function isNonProductionStardeskEnv(): boolean {
  const env = process.env.NEXT_PUBLIC_STARDESK_ENV?.trim().toLowerCase();
  return env !== "production";
}

export function getDevLoginPrefill(): DevLoginPrefill | null {
  if (!isNonProductionStardeskEnv()) {
    return null;
  }

  const email = process.env.NEXT_PUBLIC_DEV_LOGIN_PREFILL_EMAIL?.trim();
  if (!email) {
    return null;
  }

  const password =
    process.env.NEXT_PUBLIC_DEV_LOGIN_PREFILL_PASSWORD?.trim() ??
    process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD?.trim() ??
    "";

  if (!password) {
    return null;
  }

  return { email, password };
}
