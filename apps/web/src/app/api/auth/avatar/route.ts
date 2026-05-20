import { NextResponse } from "next/server";

import { buildBackendUrl } from "@/lib/api-backend";
import { getServerUser } from "@/lib/auth-server";
import { TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";
import type { User } from "@/types/user";

const SESSION_MAX_AGE = 60 * 60 * 2;

type AvatarBody = {
  avatar_url?: string | null;
  avatar_preset_id?: string | null;
};

function mergeAvatarIntoUser(cookieUser: User, body: AvatarBody): User {
  if (body.avatar_url !== undefined && body.avatar_url !== null) {
    return {
      ...cookieUser,
      avatar_url: body.avatar_url,
      avatar_preset_id: null,
    };
  }
  if (body.avatar_preset_id !== undefined && body.avatar_preset_id !== null) {
    return {
      ...cookieUser,
      avatar_preset_id: body.avatar_preset_id,
      avatar_url: null,
    };
  }
  return {
    ...cookieUser,
    avatar_url: null,
    avatar_preset_id: null,
  };
}

export async function PATCH(request: Request) {
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const cookieUser = await getServerUser();
  if (!cookieUser) {
    return NextResponse.json({ detail: "Ikke logget ind" }, { status: 401 });
  }

  let body: AvatarBody;
  try {
    body = (await request.json()) as AvatarBody;
  } catch {
    return NextResponse.json({ detail: "Ugyldig forespørgsel" }, { status: 400 });
  }

  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  let user: User = mergeAvatarIntoUser(cookieUser, body);

  if (token) {
    try {
      const upstream = await fetch(buildBackendUrl("/api/v1/auth/me/avatar"), {
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
      }
    } catch {
      // Prototype: keep cookie merge when API unavailable
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
