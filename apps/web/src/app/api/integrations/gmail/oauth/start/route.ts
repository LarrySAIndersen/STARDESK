import { proxyIntegrationOAuthStart } from "@/lib/integration-oauth-bff";

export async function GET(request: Request) {
  return proxyIntegrationOAuthStart(request, "gmail");
}
