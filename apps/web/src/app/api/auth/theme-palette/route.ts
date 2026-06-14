import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";
import { getServerUser } from "@/lib/auth-server";
import { TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";
import type { ThemePalettePreference } from "@/lib/theme-palettes";
import type { User } from "@/types/user";

const SESSION_MAX_AGE = 60 * 60 * 2;

type ThemePaletteBody = {
  preset_id?: string;
  overrides?: ThemePalettePreference["overrides"] | null;
};

function mergeThemePaletteIntoUser(cookieUser: User, body: ThemePaletteBody): User {
  return {
    ...cookieUser,
    theme_palette: {
      preset_id: (body.preset_id ?? cookieUser.theme_palette?.preset_id ?? "star-standard") as ThemePalettePreference["preset_id"],
      overrides: body.overrides ?? undefined,
    },
  };
}

export async function PATCH(request: Request) {
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const cookieUser = await getServerUser();
  if (!cookieUser) {
    return NextResponse.json({ detail: "Ikke logget ind" }, { status: 401 });
  }

  let body: ThemePaletteBody;
  try {
    body = (await request.json()) as ThemePaletteBody;
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  let user: User = mergeThemePaletteIntoUser(cookieUser, body);

  if (token) {
    try {
      const upstream = await fetch(buildBackendUrl("/api/v1/auth/me/theme-palette"), {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (upstream.ok) {
        user = (await upstream.json()) as User;
      } else {
        const payload = (await upstream.json().catch(() => null)) as { detail?: string } | null;
        return NextResponse.json(
          { detail: payload?.detail ?? "Kunne ikke gemme farvetema" },
          { status: upstream.status },
        );
      }
    } catch {
      return NextResponse.json({ detail: "API utilgængelig" }, { status: 502 });
    }
  }

  const response = NextResponse.json({ user });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(USER_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
