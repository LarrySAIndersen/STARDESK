"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SwaggerUIBundle?: any;
  }
}

const SWAGGER_UI_VERSION = "5.21.0";

export function SwaggerUiPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountSwagger() {
      if (!containerRef.current || cancelled) {
        return;
      }

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css`;
          link.onload = () => resolve();
          link.onerror = () => reject(new Error("Swagger UI CSS failed to load"));
          document.head.appendChild(link);
        }),
        new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js`;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Swagger UI bundle failed to load"));
          document.head.appendChild(script);
        }),
      ]);

      if (cancelled || !containerRef.current || !window.SwaggerUIBundle) {
        return;
      }

      window.SwaggerUIBundle({
        url: "/api/openapi",
        dom_id: "#stardesk-swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        docExpansion: "list",
        filter: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
        syntaxHighlight: { activate: true, theme: "monokai" },
      });
    }

    void mountSwagger().catch(() => {
      if (containerRef.current) {
        containerRef.current.innerHTML =
          "<p class='text-sm text-destructive'>Kunne ikke indlæse Swagger UI. Tjek at API-backend kører.</p>";
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="wire-card overflow-hidden p-0">
      <div id="stardesk-swagger-ui" ref={containerRef} className="min-h-[70vh]" />
    </div>
  );
}
