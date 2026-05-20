"use client";

import { SfChatHost } from "@/components/sf-chat/sf-chat-host";
import { getClientUser } from "@/lib/auth";
import type { User } from "@/types/user";

export function SfChatShellClient({ user }: { user: User | null }) {
  const clientUser = getClientUser() ?? user;
  return <SfChatHost user={clientUser} />;
}
