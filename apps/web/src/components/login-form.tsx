"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DemoUserPicker } from "@/components/demo-user-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_PASSWORD, DEMO_USERS, type DemoUser } from "@/lib/demo-users";
import { isDemoLoginEnabled } from "@/lib/demo-login";

export function LoginForm() {
  const router = useRouter();
  const showDemoPicker = isDemoLoginEnabled();
  const [email, setEmail] = useState(
    showDemoPicker ? (DEMO_USERS[1]?.email ?? "sf01@example.dk") : "",
  );
  const [password, setPassword] = useState(showDemoPicker ? DEMO_PASSWORD : "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function performLogin(loginEmail: string, loginPassword: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Forkert e-mail eller adgangskode");
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login mislykkedes — prøv igen",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await performLogin(email, password);
  }

  function selectUser(user: DemoUser) {
    setEmail(user.email);
    setPassword(user.password);
    setError(null);
  }

  function quickLogin(user: DemoUser) {
    setEmail(user.email);
    setPassword(user.password);
    void performLogin(user.email, user.password);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="text-center">
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">
          Log ind på STARdesk
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {showDemoPicker
            ? "Vælg en testbruger i tabellen eller indtast e-mail og adgangskode."
            : "Indtast din e-mail og adgangskode."}
        </p>
      </div>

      <div
        className={
          showDemoPicker
            ? "grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start"
            : "flex justify-center"
        }
      >
        <Card className="star-section-card w-full max-w-md overflow-hidden border-t-4 border-t-star-red shadow-lg lg:max-w-none">
          <CardHeader className="bg-star-navy text-white">
            <CardTitle className="text-white">Login</CardTitle>
            <CardDescription className="text-white/80">
              {showDemoPicker ? (
                <>
                  Standardadgangskode:{" "}
                  <span className="font-mono text-white">{DEMO_PASSWORD}</span>
                </>
              ) : (
                "STAR ITSM prototype"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Adgangskode</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <Button
                type="submit"
                className="bg-star-blue hover:bg-star-navy w-full rounded-sm font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Logger ind…" : "Log ind"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {showDemoPicker ? (
          <Card className="star-section-card overflow-hidden shadow-lg">
            <CardContent className="pt-6">
              <DemoUserPicker
                selectedEmail={email}
                onSelect={selectUser}
                onQuickLogin={quickLogin}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
