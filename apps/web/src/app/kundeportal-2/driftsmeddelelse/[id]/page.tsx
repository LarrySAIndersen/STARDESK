import { notFound } from "next/navigation";

import { Kp2ServiceMessageDetail } from "@/components/kundeportal-2/kp2-service-message-detail";
import { KP2_SERVICE_MESSAGES } from "@/lib/kundeportal-2/mock-data";

export default async function Kp2DriftsmeddelelsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const message = KP2_SERVICE_MESSAGES.find((m) => m.id === id);
  if (!message) {
    notFound();
  }
  return <Kp2ServiceMessageDetail message={message} />;
}
