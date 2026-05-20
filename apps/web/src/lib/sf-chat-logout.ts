import { apiGet, apiPut } from "@/lib/api";
import type { SfChatLogoutCheck } from "@/types/sf-chat";

export async function checkSfChatLogout(): Promise<SfChatLogoutCheck | null> {
  try {
    return await apiGet<SfChatLogoutCheck>("/api/v1/sf-chat/presence/logout-check");
  } catch {
    return null;
  }
}

export async function confirmSfChatLogout(): Promise<boolean> {
  const check = await checkSfChatLogout();
  if (!check || check.can_logout) {
    return true;
  }
  const stay = window.confirm(
    `${check.reason ?? "Der er aktivitet i SF-chat."}\n\nVil du blive logget på chat og forblive tilgængelig?`,
  );
  if (stay) {
    return false;
  }
  try {
    await apiPut("/api/v1/sf-chat/presence", { online: false, force: true });
  } catch {
    // proceed with logout
  }
  return true;
}
