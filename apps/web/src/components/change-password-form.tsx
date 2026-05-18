"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { DEMO_PASSWORD } from "@/lib/demo-users";
import { cn } from "@/lib/utils";

export function ChangePasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState(DEMO_PASSWORD);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputClass = cn(fieldError && "border-destructive ring-destructive/30");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldError(false);

    if (newPassword !== confirmPassword) {
      setError("De nye adgangskoder matcher ikke");
      setFieldError(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email,
          current_password: currentPassword,
          new_password: newPassword,
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        setFieldError(true);
        throw new Error(body.detail ?? "Kunne ikke ændre adgangskode");
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password: newPassword }),
        cache: "no-store",
      });

      if (loginResponse.ok) {
        router.replace("/");
        router.refresh();
        return;
      }

      setSuccess("Adgangskoden er opdateret. Log ind med din nye adgangskode.");
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kunne ikke ændre adgangskode — prøv igen",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("mx-auto w-full max-w-md", fieldError && "login-shake")}>
      <Card className="star-section-card overflow-hidden border-t-4 border-t-star-red shadow-lg">
        <CardHeader className="bg-star-navy text-white">
          <CardTitle className="text-white">Skift adgangskode</CardTitle>
          <CardDescription className="text-white/80">
            Angiv din e-mail og prototype-adgangskoden{" "}
            <span className="font-medium text-white">{DEMO_PASSWORD}</span> som nuværende
            adgangskode — også hvis du allerede har skiftet den før.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField label="E-mail" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                required
              />
            </PasswordField>
            <PasswordField label="Nuværende adgangskode" htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder={DEMO_PASSWORD}
                className={inputClass}
                required
              />
              <p className="text-muted-foreground text-xs">
                Brug altid <span className="font-medium">{DEMO_PASSWORD}</span> her i prototypen.
              </p>
            </PasswordField>
            <PasswordField label="Ny adgangskode" htmlFor="new-password">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={inputClass}
                minLength={8}
                required
              />
            </PasswordField>
            <PasswordField label="Bekræft ny adgangskode" htmlFor="confirm-password">
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClass}
                minLength={8}
                required
              />
            </PasswordField>
            {error ? (
              <p className="text-destructive text-sm font-medium" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="text-star-navy text-sm font-medium" role="status">
                {success}
              </p>
            ) : null}
            <Button
              type="submit"
              className="bg-star-blue hover:bg-star-navy w-full rounded-sm font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Gemmer…" : "Gem adgangskode"}
            </Button>
            <p className="text-center text-sm">
              <Link href="/" className="text-star-blue hover:text-star-navy underline">
                Tilbage til login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
