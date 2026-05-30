function secret(): string {
  const value = process.env.PROJECT_KANBAN_SECRET;
  if (!value || value.length < 16) {
    return "";
  }
  return value;
}

async function sign(payload: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return Buffer.from(signature).toString("base64url");
}

export async function verifySessionTokenEdge(token: string | undefined): Promise<boolean> {
  const key = secret();
  if (!token || !key) {
    return false;
  }
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return false;
  }
  try {
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const expected = await sign(payload, key);
    if (signature.length !== expected.length) {
      return false;
    }
    let mismatch = 0;
    for (let i = 0; i < signature.length; i += 1) {
      mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (mismatch !== 0) {
      return false;
    }
    const [, expRaw] = payload.split("|");
    const exp = Number(expRaw);
    return Number.isFinite(exp) && exp > Date.now();
  } catch {
    return false;
  }
}
