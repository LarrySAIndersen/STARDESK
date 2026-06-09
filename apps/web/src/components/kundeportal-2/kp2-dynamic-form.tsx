"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Paperclip, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { Kp2RequisitionerBlock } from "@/components/kundeportal-2/kp2-requisitioner-block";
import { getClientUser } from "@/lib/auth";
import {
  buildKp2ZodSchema,
  isKp2FieldVisible,
  kp2DefaultValues,
} from "@/lib/kundeportal-2/form-zod";
import { submitKp2Ticket } from "@/lib/kundeportal-2/submit-ticket";
import type { Kp2FormSchema } from "@/lib/kundeportal-2/types";
import { KP2_BASE } from "@/lib/kundeportal-2/types";

export function Kp2DynamicForm({ schema }: { schema: Kp2FormSchema }) {
  const user = getClientUser();
  const router = useRouter();
  const zodSchema = useMemo(() => buildKp2ZodSchema(schema), [schema]);
  const defaults = useMemo(() => kp2DefaultValues(schema), [schema]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, string | boolean>>({
    resolver: zodResolver(zodSchema) as Resolver<Record<string, string | boolean>>,
    defaultValues: defaults,
    mode: "onChange",
  });

  const values = watch();

  async function onSubmit(data: Record<string, string | boolean>) {
    setSubmitError(null);
    try {
      const ticket = await submitKp2Ticket(schema, data, files);
      router.push(`${KP2_BASE}/kvittering?nr=${encodeURIComponent(ticket.ticket_number)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Kunne ikke oprette sagen");
    }
  }

  return (
    <div className="portal-v2-page mx-auto w-full max-w-5xl pb-10">
      <div className="mb-4">
        <Link href={`${KP2_BASE}/service-requests`} className="kp2-back-link">
          <ArrowLeft className="size-4" aria-hidden />
          Tilbage til katalog
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <header>
            <h1 className="kp2-page-title">{schema.title}</h1>
          </header>

          <Kp2RequisitionerBlock user={user} />

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            {schema.fields.map((field) => {
              if (!isKp2FieldVisible(field, values)) return null;
              const error = errors[field.name]?.message as string | undefined;
              const requiredMark = field.required ? " *" : "";

              return (
                <div key={field.name} className="kp2-field">
                  {field.type === "checkbox" ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" {...register(field.name)} />
                      <span>
                        {field.label}
                        {requiredMark}
                      </span>
                    </label>
                  ) : (
                    <>
                      <label htmlFor={`kp2-${field.name}`} className="kp2-field-label">
                        {field.label}
                        {requiredMark}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          id={`kp2-${field.name}`}
                          rows={5}
                          className="kp2-input"
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? `kp2-${field.name}-err` : undefined}
                          {...register(field.name)}
                        />
                      ) : field.type === "select" ? (
                        <select
                          id={`kp2-${field.name}`}
                          className="kp2-input"
                          aria-invalid={Boolean(error)}
                          {...register(field.name)}
                        >
                          <option value="">Vælg...</option>
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "datetime" ? (
                        <input
                          id={`kp2-${field.name}`}
                          type="datetime-local"
                          className="kp2-input"
                          aria-invalid={Boolean(error)}
                          {...register(field.name)}
                        />
                      ) : (
                        <input
                          id={`kp2-${field.name}`}
                          type="text"
                          className="kp2-input"
                          placeholder={field.placeholder}
                          aria-invalid={Boolean(error)}
                          {...register(field.name)}
                        />
                      )}
                    </>
                  )}
                  {field.helpText ? (
                    <p className="text-muted-foreground text-xs">{field.helpText}</p>
                  ) : null}
                  {field.link ? (
                    <a href={field.link.href} className="text-primary text-xs underline">
                      {field.link.label}
                    </a>
                  ) : null}
                  {error ? (
                    <p id={`kp2-${field.name}-err`} className="text-destructive text-xs" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}

            {schema.attachments ? (
              <div className="kp2-field">
                <span className="kp2-field-label">Vedhæftninger</span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="kp2-btn-secondary cursor-pointer">
                    <Paperclip className="size-4" aria-hidden />
                    Vedhæft fil
                    <input
                      type="file"
                      className="sr-only"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    />
                  </label>
                  <span className="text-muted-foreground text-xs">Ctrl+V / Cmd+V</span>
                </div>
                {files.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {files.map((f) => (
                      <li key={f.name}>{f.name}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {schema.gdprNote ? (
              <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                {schema.gdprNote}
              </p>
            ) : null}

            <p className="text-muted-foreground text-xs">* Påkrævede felter</p>

            {submitError ? (
              <p className="text-destructive text-sm" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="flex justify-end">
              <button type="submit" className="kp2-btn-primary" disabled={isSubmitting}>
                {schema.submitLabel ?? "Indsend"}
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="kp2-card p-4">
            <button type="button" className="kp2-btn-secondary w-full">
              <Share2 className="size-4" aria-hidden />
              Del
            </button>
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Du kan dele henvendelsen med andre, saafremt indstillingerne tillader det. Personlige
              oplysninger bliver synlige for dem, du deler med.
            </p>
          </div>
          <div className="kp2-card p-4">
            <h2 className="kp2-section-title mb-2">Hjælp</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">{schema.helpText}</p>
            {schema.onBehalfOf ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Du kan bestille på egne eller andres vegne via rekvirent-felterne.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
