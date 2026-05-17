import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Indlæser…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
