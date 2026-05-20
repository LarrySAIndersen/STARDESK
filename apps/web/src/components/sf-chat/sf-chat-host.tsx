"use client";

import { usePathname } from "next/navigation";

import { SfChatAgentConsole } from "@/components/sf-chat/sf-chat-agent-console";
import { SfChatWidget } from "@/components/sf-chat/sf-chat-widget";
import { isStaff } from "@/lib/auth";
import type { User } from "@/types/user";

const CUSTOMER_CHAT_PATHS = ["/", "/portal"];

export function SfChatHost({ user }: { user: User | null }) {
  const pathname = usePathname();

  if (!user) {
    return null;
  }

  if (isStaff(user)) {
    return <SfChatAgentConsole />;
  }

  const showCustomerWidget = CUSTOMER_CHAT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!showCustomerWidget) {
    return null;
  }

  return <SfChatWidget />;
}
