import { LoginFormCore } from "@/components/login-form-core";
import { getDevLoginPrefill } from "@/lib/dev-login-prefill";

export function LoginForm() {
  const prefill = getDevLoginPrefill();

  return (
    <LoginFormCore
      initialEmail={prefill?.email}
      initialPassword={prefill?.password}
    />
  );
}
