"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, Sparkles, Table2 } from "lucide-react";

import { definitionForKind } from "@/lib/workspace-landing/catalog";
import {
  WORKSPACE_LAYOUT_TABLE,
  WORKSPACE_WIDGET_INSTANCE_FIELDS,
  databaseSourceForKind,
  formatLayoutTimestamp,
} from "@/lib/workspace-landing/datamodel";
import { visualForKind } from "@/lib/workspace-landing/sitemap-visuals";
import type { WorkspaceLandingConfig, WorkspaceSpace, WorkspaceWidgetInstance } from "@/lib/workspace-landing/types";
import type { WorkspaceLandingRecord } from "@/lib/workspace-landing/api";

type WorkspaceSitemapDatamodelProps = Readonly<{
  userId: string;
  layout: WorkspaceLandingConfig;
  record: WorkspaceLandingRecord | null;
  loading: boolean;
}>;

function SchemaTable({
  title,
  columns,
}: Readonly<{
  title: string;
  columns: readonly { name: string; type: string; note: string }[];
}>) {
  return (
    <div className="workspace-sitemap-datamodel__schema">
      <h3 className="workspace-sitemap-datamodel__schema-title">
        <Table2 className="size-4" aria-hidden />
        {title}
      </h3>
      <div className="workspace-sitemap-datamodel__table-wrap">
        <table className="workspace-sitemap-datamodel__table">
          <thead>
            <tr>
              <th>Kolonne</th>
              <th>Type</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.name}>
                <td>
                  <code>{column.name}</code>
                </td>
                <td>{column.type}</td>
                <td className="text-muted-foreground">{column.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InstanceRow({
  instance,
  space,
  defaultOpen,
}: Readonly<{
  instance: WorkspaceWidgetInstance;
  space: WorkspaceSpace;
  defaultOpen?: boolean;
}>) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const definition = definitionForKind(instance.kind);
  const visual = visualForKind(instance.kind);
  const Icon = visual.icon;
  const source = databaseSourceForKind(instance.kind);

  return (
    <article className="workspace-sitemap-datamodel__instance">
      <button
        type="button"
        className="workspace-sitemap-datamodel__instance-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="workspace-sitemap-datamodel__instance-icon" style={{ color: visual.accent }}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="workspace-sitemap-datamodel__instance-label">{definition.label}</span>
          <span className="workspace-sitemap-datamodel__instance-id">
            <code>{instance.instanceId}</code>
          </span>
        </span>
        <span className="workspace-sitemap-datamodel__instance-meta">
          {space} · order {instance.order}
        </span>
        {open ? (
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
        ) : (
          <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="workspace-sitemap-datamodel__instance-body">
          <dl className="workspace-sitemap-datamodel__dl">
            <div>
              <dt>kind</dt>
              <dd>
                <code>{instance.kind}</code>
              </dd>
            </div>
            <div>
              <dt>span</dt>
              <dd>{instance.span}</dd>
            </div>
            <div>
              <dt>hidden</dt>
              <dd>{instance.hidden ? "true" : "false"}</dd>
            </div>
            <div>
              <dt>Primær nøgle</dt>
              <dd>
                <code>{source.idField}</code>
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{source.note}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {source.tables.map((table) => (
              <span key={table} className="workspace-sitemap-datamodel__table-chip">
                {table}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function WorkspaceSitemapDatamodel({
  userId,
  layout,
  record,
  loading,
}: WorkspaceSitemapDatamodelProps) {
  const displayUserId = record?.userId ?? userId;
  const layoutVersion = record?.layoutVersion ?? 1;
  const updatedAt = record?.updatedAt ?? null;
  const dataSource = record ? "PostgreSQL (API)" : "localStorage (offline)";

  const instanceCount = useMemo(
    () => layout.personal.length + layout.team.length,
    [layout.personal.length, layout.team.length],
  );

  return (
    <div className="workspace-sitemap-datamodel">
      <header className="workspace-sitemap-datamodel__hero">
        <div className="workspace-sitemap-datamodel__hero-icon">
          <Sparkles className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="workspace-sitemap-datamodel__eyebrow">Database-ekspert</p>
          <h2 className="workspace-sitemap-datamodel__title">Datamodel — arbejdsrum</h2>
          <p className="workspace-sitemap-datamodel__lead">
            Skema og live data fra <code>{WORKSPACE_LAYOUT_TABLE.name}</code>. Hver widget har et
            stabilt <code>instance_id</code> — som sag-id på en sag.
          </p>
        </div>
      </header>

      <section className="workspace-sitemap-datamodel__record" aria-label="Live database-række">
        <div className="workspace-sitemap-datamodel__record-head">
          <Database className="size-4 text-star-blue" aria-hidden />
          <span>Live række</span>
          {loading ? <span className="workspace-sitemap-datamodel__pill">Indlæser…</span> : null}
          {!loading && record ? (
            <span className="workspace-sitemap-datamodel__pill workspace-sitemap-datamodel__pill--ok">
              Synkroniseret
            </span>
          ) : null}
          {!loading && !record ? (
            <span className="workspace-sitemap-datamodel__pill workspace-sitemap-datamodel__pill--warn">
              Kun lokal kopi
            </span>
          ) : null}
        </div>
        <dl className="workspace-sitemap-datamodel__record-grid">
          <div>
            <dt>user_id</dt>
            <dd>
              <code className="break-all">{displayUserId}</code>
            </dd>
          </div>
          <div>
            <dt>layout_version</dt>
            <dd>{layoutVersion}</dd>
          </div>
          <div>
            <dt>updated_at</dt>
            <dd>{formatLayoutTimestamp(updatedAt)}</dd>
          </div>
          <div>
            <dt>widget-instanser</dt>
            <dd>{instanceCount}</dd>
          </div>
          <div>
            <dt>kilde</dt>
            <dd>{dataSource}</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>
              <code>{WORKSPACE_LAYOUT_TABLE.apiPath}</code>
            </dd>
          </div>
        </dl>
      </section>

      <div className="workspace-sitemap-datamodel__grid">
        <SchemaTable title={`Tabel: ${WORKSPACE_LAYOUT_TABLE.name}`} columns={WORKSPACE_LAYOUT_TABLE.columns} />
        <SchemaTable title="JSONB: layout.personal / layout.team[]" columns={WORKSPACE_WIDGET_INSTANCE_FIELDS} />
      </div>

      <section className="workspace-sitemap-datamodel__instances">
        <h3 className="workspace-sitemap-datamodel__section-title">Widget-instanser (live layout)</h3>
        <div className="workspace-sitemap-datamodel__space-block">
          <p className="workspace-sitemap-datamodel__space-label">Eget space</p>
          {layout.personal.map((instance, index) => (
            <InstanceRow key={instance.instanceId} instance={instance} space="personal" defaultOpen={index === 0} />
          ))}
        </div>
        <div className="workspace-sitemap-datamodel__space-block">
          <p className="workspace-sitemap-datamodel__space-label">Team space</p>
          {layout.team.map((instance) => (
            <InstanceRow key={instance.instanceId} instance={instance} space="team" />
          ))}
        </div>
      </section>

      <p className="text-muted-foreground text-xs">
        SQL: <code>{WORKSPACE_LAYOUT_TABLE.sqlMigration}</code> · Dokumentation:{" "}
        <code>docs/data-model.md</code>
      </p>
    </div>
  );
}
