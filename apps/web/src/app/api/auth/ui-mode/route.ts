import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth-server";
import {
  isClassicOnlyUser,
  isModernOnlyUser,
  UI_MODE_COOKIE,
  type UiMode,
} from "@/lib/classic-ui-mode";

const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function parseMode(body: unknown): UiMode | null {
  if (!body || typeof body !== "object" || !("mode" in body)) {
    return null;
  }
  const mode = (body as { mode: unknown }).mode;
  return mode === "classic" || mode === "modern" ? mode : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const mode = parseMode(body);
  if (!mode) {
    return NextResponse.json({ detail: "mode skal være classic eller modern" }, { status: 400 });
  }

  const user = await getServerUser();
  if (isClassicOnlyUser(user?.ui_mode) && mode === "modern") {
    return NextResponse.json(
      { detail: "Klassisk visning er låst for denne bruger" },
      { status: 403 },
    );
  }
  if (isModernOnlyUser(user?.ui_mode) && mode === "classic") {
    return NextResponse.json(
      { detail: "Moderne visning er låst for denne bruger" },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ mode });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(UI_MODE_COOKIE, mode, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
