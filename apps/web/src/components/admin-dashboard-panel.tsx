"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { FileUp, LayoutDashboard, Shield, Ticket, UserCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdminTicketImportDialog } from "@/components/admin-ticket-import-dialog";
import { AdminUserImportDialog } from "@/components/admin-user-import-dialog";
import { apiGet } from "@/lib/api";
import type { UserAdminMeta } from "@/types/admin-user";
import type { UserRole } from "@/types/user";

const ADMIN_LINKS = [
  { href: "/users", label: "Brugere", icon: UserCog, description: "Konti og rettigheder" },
  { href: "/admin/sla", label: "SLA-indstillinger", icon: Shield, description: "Politikker og frister" },
  {
    href: "/admin/categories",
    label: "Kategorier",
    icon: Shield,
    description: "Kategori- og underkategorier",
  },
  {
    href: "/admin/dependencies",
    label: "Afhængigheder",
    icon: Shield,
    description: "Sikkerhed og afhængigheder",
  },
] as const;

export function AdminDashboardPanel({ currentUserRole }: { currentUserRole: UserRole }) {
  const [meta, setMeta] = useState<UserAdminMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [importingUsers, setImportingUsers] = useState(false);
  const [importingTickets, setImportingTickets] = useState(false);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const data = await apiGet<UserAdminMeta>("/api/v1/users/meta");
      setMeta(data);
    } catch {
      setMeta(null);
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    fireAndForget(loadMeta());
  }, [loadMeta]);

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ADMIN_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="wire-card hover:border-star-navy flex flex-col gap-2 p-4 transition-colors"
            >
              <Icon className="text-star-navy size-5 opacity-80" aria-hidden />
              <span className="text-star-navy font-semibold">{link.label}</span>
              <span className="text-muted-foreground text-xs">{link.description}</span>
            </Link>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileUp className="text-star-navy size-5" aria-hidden />
          <h2 className="text-star-navy text-lg font-semibold">Dataimport</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Importer brugere og TOPdesk-sager fra CSV eller JSON. Brugerimport er flyttet hertil fra
          brugerlisten.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="wire-card flex flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <UserCog className="text-star-navy mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <h3 className="text-star-navy font-semibold">Importer brugere</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  CSV fra TOPdesk eller Excel med e-mail, navn, rolle, grupper og organisation.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="wire-btn mt-auto w-fit"
              disabled={loadingMeta || !meta}
              onClick={() => setImportingUsers(true)}
            >
              Vælg CSV-fil og importer
            </button>
          </article>

          <article className="wire-card flex flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <Ticket className="text-star-navy mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <h3 className="text-star-navy font-semibold">Importer TOPdesk-sager</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  CSV eller JSON med titel, beskrivelse, sagsnummer, status, prioritet, kategori og
                  gruppe.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="wire-btn mt-auto w-fit"
              onClick={() => setImportingTickets(true)}
            >
              Vælg CSV/JSON og importer
            </button>
          </article>
        </div>
      </section>

      <section className="wire-card flex items-start gap-3 p-4">
        <LayoutDashboard className="text-star-navy size-5 shrink-0 opacity-70" aria-hidden />
        <p className="text-muted-foreground text-sm">
          Efter import kan du gennemgå brugere under{" "}
          <Link href="/users" className="text-star-navy font-medium underline">
            Brugere
          </Link>{" "}
          og sager under{" "}
          <Link href="/tickets" className="text-star-navy font-medium underline">
            Alle sager
          </Link>
          .
        </p>
      </section>

      {importingUsers && meta ? (
        <AdminUserImportDialog
          roleOptions={meta.roles}
          currentUserRole={currentUserRole}
          onClose={() => setImportingUsers(false)}
          onImported={() => setImportingUsers(false)}
        />
      ) : null}

      {importingTickets ? (
        <AdminTicketImportDialog
          onClose={() => setImportingTickets(false)}
          onImported={() => setImportingTickets(false)}
        />
      ) : null}
    </div>
  );
}
