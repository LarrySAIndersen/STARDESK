"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

import { staffLandingPath } from "@/lib/classic-ui-mode";
import { isStaff } from "@/lib/auth";
import type { User } from "@/types/user";

import { HELPDESK_LOGIN_HTML } from "./helpdesk-login-static";

import "./helpdesk-login.css";

type HelpdeskView =
  | "landing"
  | "star-city"
  | "partnere"
  | "landssupport"
  | "login-help"
  | "starbot"
  | "search"
  | "mine-sager"
  | "opret-sag"
  | "status";

const PHOTO_INTERVAL_MS = 20_000;
const LEGACY_HELPDESK_THEME_KEY = "star-helpdesk-theme";

export function HelpdeskLoginPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const [activeView, setActiveView] = useState<HelpdeskView>("landing");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showView = useCallback((name: HelpdeskView) => {
    setActiveView(name);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    try {
      const legacy = localStorage.getItem(LEGACY_HELPDESK_THEME_KEY);
      if (legacy === "dark") setTheme("dark");
      if (legacy) localStorage.removeItem(LEGACY_HELPDESK_THEME_KEY);
    } catch {
      /* ignore */
    }
  }, [setTheme]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLElement>(".view").forEach((panel) => {
      const id = panel.id.replace(/^view-/, "");
      panel.classList.toggle("active", id === activeView);
    });
  }, [activeView]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const viewTrigger = target.closest("[data-hd-view]") as HTMLElement | null;
      if (viewTrigger) {
        event.preventDefault();
        const view = viewTrigger.getAttribute("data-hd-view") as HelpdeskView | null;
        if (view) showView(view);
        return;
      }

      const actionTrigger = target.closest("[data-hd-action]") as HTMLElement | null;
      if (!actionTrigger) return;

      const action = actionTrigger.getAttribute("data-hd-action");
      if (action === "toggle-theme") {
        event.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }
    }

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [resolvedTheme, setTheme, showView]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || activeView !== "landing") return;

    const slides = Array.from(root.querySelectorAll<HTMLElement>(".photo-slide"));
    const dots = Array.from(root.querySelectorAll<HTMLButtonElement>(".photo-dot"));
    const progressBar = root.querySelector<HTMLElement>(".photo-progress-bar");
    if (!slides.length) return;

    let current = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    function restartProgress() {
      if (!progressBar) return;
      progressBar.classList.remove("run");
      progressBar.getBoundingClientRect();
      progressBar.classList.add("run");
    }

    function goTo(idx: number) {
      slides[current]?.classList.remove("active");
      dots[current]?.classList.remove("active");
      current = (idx + slides.length) % slides.length;
      slides[current]?.classList.add("active");
      dots[current]?.classList.add("active");
      restartProgress();
    }

    function next() {
      goTo(current + 1);
    }

    function start() {
      stop();
      restartProgress();
      timer = setInterval(next, PHOTO_INTERVAL_MS);
    }

    function stop() {
      if (timer) clearInterval(timer);
    }

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        goTo(index);
        start();
      });
    });

    const carousel = root.querySelector(".photo-carousel");
    carousel?.addEventListener("mouseenter", stop);
    carousel?.addEventListener("mouseleave", start);

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      stop();
      carousel?.removeEventListener("mouseenter", stop);
      carousel?.removeEventListener("mouseleave", start);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeView]);

  async function performLogin(email: string, password: string) {
    setIsSubmitting(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          detail?: string | Array<{ msg?: string }>;
        };
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
        throw new Error("Login mislykkedes — uventet svar fra serveren");
      }
      const body = (await response.json()) as { user?: User };
      await fetch("/api/auth/ui-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ mode: "modern" }),
      });
      window.location.replace(
        isStaff(body.user ?? null)
          ? staffLandingPath(body.user ?? null, "modern")
          : "/portal",
      );
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Login mislykkedes — prøv igen",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function bindCredentialForm(viewId: string) {
      const view = root!.querySelector(viewId);
      const emailInput = view?.querySelector<HTMLInputElement>('input[type="email"]');
      const passwordInput = view?.querySelector<HTMLInputElement>('input[type="password"]');
      const textInput = view?.querySelector<HTMLInputElement>('input[type="text"]');
      const loginInput = emailInput ?? textInput;
      const submitButtons = view?.querySelectorAll<HTMLButtonElement>(".sso-btn");
      const credentialSubmit =
        submitButtons && submitButtons.length > 1
          ? submitButtons[submitButtons.length - 1]
          : submitButtons?.[0];

      function onSubmit(event: Event) {
        event.preventDefault();
        const email = loginInput?.value.trim() ?? "";
        const password = passwordInput?.value ?? "";
        if (!email || !password) {
          setLoginError("Indtast bruger og adgangskode");
          return;
        }
        fireAndForget(performLogin(email, password));
      }

      credentialSubmit?.addEventListener("click", onSubmit);
      return () => credentialSubmit?.removeEventListener("click", onSubmit);
    }

    const unbindStarCity = bindCredentialForm("#view-star-city");
    const unbindPartnere = bindCredentialForm("#view-partnere");
    const unbindLandssupport = bindCredentialForm("#view-landssupport");

    return () => {
      unbindStarCity?.();
      unbindPartnere?.();
      unbindLandssupport?.();
    };
  }, [activeView]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLButtonElement>(".sso-btn").forEach((button) => {
      button.disabled = isSubmitting;
    });
  }, [isSubmitting]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !loginError) return;

    const activePanel = root.querySelector(`#view-${activeView} .login-form-card`);
    activePanel?.querySelector(".hd-login-error")?.remove();
    if (!activePanel) return;

    const alert = document.createElement("div");
    alert.className = "hd-login-error";
    alert.setAttribute("role", "alert");
    const paragraph = document.createElement("p");
    paragraph.textContent = loginError;
    alert.appendChild(paragraph);
    const submitBtn = activePanel.querySelector('.sso-btn[style*="margin-top"], .sso-btn:last-of-type');
    submitBtn?.insertAdjacentElement("beforebegin", alert);
  }, [activeView, loginError]);

  return (
    <div className="hd-login min-h-dvh" ref={rootRef}>
      <div
        dangerouslySetInnerHTML={{ __html: HELPDESK_LOGIN_HTML }}
        suppressHydrationWarning
      />
      <p className="hd-login-alt-link">
        <Link href="/">Anden login-side (STARdesk)</Link>
      </p>
    </div>
  );
}
