import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center px-6 py-16">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Indlæser…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
