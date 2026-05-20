import { proxyIntegrationOAuthCallback } from "@/lib/integration-oauth-bff";

export async function GET(request: Request) {
  return proxyIntegrationOAuthCallback(request, "slack");
}
