"use client";

import Link from "next/link";
import { useState } from "react";

import { DemoUserPicker } from "@/components/demo-user-picker";
import { StarLogo } from "@/components/star-logo";
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
import { staffLandingPath } from "@/lib/classic-ui-mode";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

export function LoginForm() {
  const showDemoPicker = isDemoLoginEnabled();
  const [email, setEmail] = useState(
    showDemoPicker ? (DEMO_USERS[1]?.email ?? "sf01@example.dk") : "",
  );
  const [password, setPassword] = useState(showDemoPicker ? DEMO_PASSWORD : "");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useClassicUi, setUseClassicUi] = useState(false);

  const inputClass = cn(fieldError && "border-destructive ring-destructive/30");

  async function performLogin(loginEmail: string, loginPassword: string) {
    setIsSubmitting(true);
    setError(null);
    setFieldError(false);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          detail?: string | Array<{ msg?: string }>;
        };
        setFieldError(true);
        const detail =
          typeof body.detail === "string"
            ? body.detail
            : Array.isArray(body.detail)
              ? (body.detail[0]?.msg ?? "Forkert e-mail eller adgangskode")
              : "Forkert e-mail eller adgangskode";
        throw new Error(detail);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setFieldError(true);
        throw new Error("Login mislykkedes — uventet svar fra serveren");
      }
      const body = (await response.json()) as { user?: User };
      const uiMode = useClassicUi ? "classic" : "modern";
      await fetch("/api/auth/ui-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ mode: uiMode }),
      });
      window.location.replace(staffLandingPath(body.user ?? null, uiMode));
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
    setFieldError(false);
  }

  function quickLogin(user: DemoUser) {
    setEmail(user.email);
    setPassword(user.password);
    void performLogin(user.email, user.password);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className={cn("space-y-8", fieldError && "login-shake")}>
        <div className="flex flex-col items-center gap-4 text-center">
          <StarLogo className="size-10" />
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
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (fieldError) setFieldError(false);
                    }}
                    className={inputClass}
                    required
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={useClassicUi}
                    onChange={(e) => setUseClassicUi(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Klassisk visning</span>
                    <span className="text-muted-foreground block text-xs">
                      TOPdesk-lignende moduler (Incidents, Changes, …) — kun for medarbejdere
                    </span>
                  </span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="password">Adgangskode</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (fieldError) setFieldError(false);
                    }}
                    className={inputClass}
                    required
                  />
                </div>
                {error ? (
                  <div
                    className="border-destructive/40 bg-destructive/5 rounded-md border px-3 py-2"
                    role="alert"
                    aria-live="polite"
                  >
                    <p className="text-destructive text-sm font-medium">{error}</p>
                  </div>
                ) : null}
                <Button
                  type="submit"
                  className="bg-star-blue hover:bg-star-navy w-full rounded-sm font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Logger ind…" : "Log ind"}
                </Button>
                <p className="text-center text-sm">
                  <Link
                    href="/skift-adgangskode"
                    className="text-star-blue hover:text-star-navy underline"
                  >
                    Skift adgangskode
                  </Link>
                </p>
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
    </div>
  );
}
