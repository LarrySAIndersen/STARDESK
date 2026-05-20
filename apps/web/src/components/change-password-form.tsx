"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthLayoutV2 } from "@/components/auth/auth-layout.v2";
import { FirstLoginCardV2 } from "@/components/auth/first-login-card.v2";
import { PasswordInputV2 } from "@/components/auth/password-input.v2";
import { PasswordStrengthMeterV2 } from "@/components/auth/password-strength-meter.v2";
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
import { getClientUser, writeUserCookie } from "@/lib/auth";
import { DEMO_PASSWORD } from "@/lib/demo-users";
import { PASSWORD_VALIDATION_MESSAGE, validatePassword } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

type ChangePasswordFormProps = {
  required?: boolean;
  initialEmail?: string;
};

export function ChangePasswordForm({
  required = false,
  initialEmail = "",
}: ChangePasswordFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState(required ? "" : DEMO_PASSWORD);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineConfirmMismatch, setInlineConfirmMismatch] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      return;
    }
    const sessionUser = getClientUser();
    if (sessionUser?.email) {
      setEmail(sessionUser.email);
    }
  }, [initialEmail]);

  const inputClass = cn(fieldError && "border-destructive ring-destructive/30");
  const v2FieldErrorClass = fieldError ? "border-red-500/70 ring-2 ring-red-500/25" : undefined;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldError(false);

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      setFieldError(true);
      return;
    }

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
        const loginBody = (await loginResponse.json()) as { user?: Parameters<typeof writeUserCookie>[0] };
        if (loginBody.user) {
          writeUserCookie(loginBody.user);
        }
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

  if (required) {
    return (
      <AuthLayoutV2>
        <div className={cn("w-full max-w-[420px]", fieldError && "login-shake")}>
          <FirstLoginCardV2
            title="Skift adgangskode"
            subtitle="Første gangs adgangskodeskift"
            infoText="Du skal skifte adgangskode første gang du logger ind. Den nye adgangskode skal være mindst 8 tegn og må kun indeholde bogstaver og tal."
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] font-medium text-[#cbd5e1]">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={cn(
                    "h-10 rounded-lg border border-white/10 bg-[#0a0e1a] px-3 text-sm text-white placeholder:text-[#64748b] focus-visible:border-[#003F8A] focus-visible:ring-2 focus-visible:ring-[#003F8A]/35 md:text-sm",
                    v2FieldErrorClass,
                  )}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-[13px] font-medium text-[#cbd5e1]">
                  Nuværende adgangskode
                </Label>
                <PasswordInputV2
                  id="current-password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  inputClassName={v2FieldErrorClass}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-[13px] font-medium text-[#cbd5e1]">
                  Ny adgangskode
                </Label>
                <PasswordInputV2
                  id="new-password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  inputClassName={v2FieldErrorClass}
                  minLength={8}
                  pattern="[A-Za-z0-9]{8,}"
                  title={PASSWORD_VALIDATION_MESSAGE}
                  required
                />
                <PasswordStrengthMeterV2 password={newPassword} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-[13px] font-medium text-[#cbd5e1]">
                  Bekræft ny adgangskode
                </Label>
                <PasswordInputV2
                  id="confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setInlineConfirmMismatch(false);
                  }}
                  onBlur={() => {
                    if (confirmPassword && newPassword !== confirmPassword) {
                      setInlineConfirmMismatch(true);
                    } else {
                      setInlineConfirmMismatch(false);
                    }
                  }}
                  inputClassName={cn(v2FieldErrorClass, inlineConfirmMismatch && "border-amber-500/60")}
                  minLength={8}
                  pattern="[A-Za-z0-9]{8,}"
                  title={PASSWORD_VALIDATION_MESSAGE}
                  required
                />
                {inlineConfirmMismatch ? (
                  <p className="text-sm text-amber-400/95" role="status">
                    Adgangskoderne matcher ikke
                  </p>
                ) : null}
              </div>

              {error ? (
                <p className="text-sm font-medium text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="text-sm font-medium text-emerald-400" role="status">
                  {success}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="h-10 w-full rounded-lg border-0 bg-[#003F8A] font-medium text-white shadow-none hover:bg-[#002d66] disabled:bg-[#475569] disabled:text-[#cbd5e1] disabled:opacity-100"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Gemmer…" : "Gem adgangskode"}
              </Button>
            </form>
          </FirstLoginCardV2>
        </div>
      </AuthLayoutV2>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-md", fieldError && "login-shake")}>
      <Card className="star-section-card overflow-hidden border-t-4 border-t-star-red shadow-lg">
        <CardHeader className="bg-star-navy text-white">
          <CardTitle className="text-white">Skift adgangskode</CardTitle>
          <CardDescription className="text-white/80">
            <>
              Angiv din e-mail og prototype-adgangskoden{" "}
              <span className="font-medium text-white">{DEMO_PASSWORD}</span> som nuværende
              adgangskode — også hvis du allerede har skiftet den før.
            </>
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
                pattern="[A-Za-z0-9]{8,}"
                title={PASSWORD_VALIDATION_MESSAGE}
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
                pattern="[A-Za-z0-9]{8,}"
                title={PASSWORD_VALIDATION_MESSAGE}
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
