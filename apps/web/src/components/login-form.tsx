"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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
import { apiPost } from "@/lib/api";
import { setSession } from "@/lib/auth";
import type { LoginResponse } from "@/types/user";

const DEMO_USERS = [
  { email: "submitter@example.dk", role: "Submitter" },
  { email: "agent@example.dk", role: "Agent (Service Desk)" },
  { email: "admin@example.dk", role: "Administrator" },
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("agent@example.dk");
  const [password, setPassword] = useState("Stardesk2026!");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<LoginResponse>("/api/v1/auth/login", {
        email,
        password,
      });
      setSession(result.access_token, result.user);
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login mislykkedes — prøv igen",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Log ind på STARdesk</CardTitle>
        <CardDescription>
          Vælg en demo-bruger nedenfor. Adgangskode for alle:{" "}
          <span className="font-mono">Stardesk2026!</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Logger ind…" : "Log ind"}
          </Button>
        </form>
        <div className="mt-6 space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Demo-brugere
          </p>
          <ul className="space-y-1 text-sm">
            {DEMO_USERS.map((user) => (
              <li key={user.email}>
                <button
                  type="button"
                  className="text-primary hover:underline text-left"
                  onClick={() => setEmail(user.email)}
                >
                  {user.role}
                </button>
                <span className="text-muted-foreground"> — {user.email}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

