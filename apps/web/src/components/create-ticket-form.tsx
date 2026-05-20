"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TicketCreateLlmAssistant,
  type IntakeAssistDraft,
} from "@/components/ticket-create-llm-assistant";
import { TicketIntakeQuestions, type IntakeAnswers } from "@/components/ticket-intake-questions";
import { TicketTagsEmojiFields } from "@/components/ticket-tags-emoji-fields";
import { assertNoCprInFreeText, validateCprOptional } from "@/lib/cpr";
import { parseTagsInput } from "@/lib/ticket-tags";
import { apiGet, apiPost, apiPostForm } from "@/lib/api";
import type { Attachment } from "@/types/attachment";
import type { Category } from "@/types/category";
import type { SubCause } from "@/types/sub-cause";
import type { Ticket, TicketCreateInput } from "@/types/ticket";

const schema = z
  .object({
    ticket_type: z.enum(["service_request", "incident", "problem"]),
    title: z.string().min(3, "Titel skal være mindst 3 tegn"),
    description: z.string().min(10, "Beskrivelse skal være mindst 10 tegn"),
    priority: z.enum(["critical", "high", "medium", "low"]),
    category_id: z.string().optional(),
    subcategory_id: z.string().optional(),
    is_major: z.boolean(),
    is_security_ticket: z.boolean(),
    gdpr_consent: z.boolean(),
    subject_cpr: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const textCheck = assertNoCprInFreeText(data.title, data.description);
    if (textCheck !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: textCheck,
        path: ["description"],
      });
    }

    const cpr = data.subject_cpr?.trim() ?? "";
    if (!cpr) {
      return;
    }

    const cprCheck = validateCprOptional(data.subject_cpr);
    if (cprCheck !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: cprCheck,
        path: ["subject_cpr"],
      });
    }
    if (!data.gdpr_consent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Du skal acceptere behandling af personoplysninger (GDPR)",
        path: ["gdpr_consent"],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const selectClassName = "wire-form-input h-9";
const inputClassName = "wire-form-input h-9";
const textareaClassName = "wire-form-input min-h-[8rem] resize-y";

const SF_CHAT_TICKET_PREFILL_KEY = "stardesk_sf_chat_ticket_description";

export function CreateTicketForm({
  categories,
  staffOnly = false,
  prefillFromSfChat = false,
}: {
  categories: Category[];
  staffOnly?: boolean;
  /** When true, read transcript from sessionStorage (set by SF chat widget). */
  prefillFromSfChat?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [subCauses, setSubCauses] = useState<SubCause[]>([]);
  const [selectedSubCauseIds, setSelectedSubCauseIds] = useState<string[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers>({});
  const [storeTickets, setStoreTickets] = useState<Ticket[]>([]);
  const [parentTicketId, setParentTicketId] = useState("");
  const [ticketSource, setTicketSource] = useState<"portal" | "email" | "phone" | "chat">("phone");
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ticket_type: "incident",
      priority: "medium",
      is_major: false,
      is_security_ticket: false,
      gdpr_consent: false,
      subject_cpr: "",
    },
  });

  const categoryId = watch("category_id");
  const watchedTitle = watch("title") ?? "";
  const watchedDescription = watch("description") ?? "";
  const isMajor = watch("is_major");
  const subjectCpr = useWatch({ control, name: "subject_cpr" }) ?? "";
  const cprFilled = subjectCpr.trim().length > 0;

  useEffect(() => {
    if (!cprFilled) {
      setValue("gdpr_consent", false);
    }
  }, [cprFilled, setValue]);

  useEffect(() => {
    if (!prefillFromSfChat || typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(SF_CHAT_TICKET_PREFILL_KEY);
      if (raw && raw.trim().length >= 10) {
        setValue("description", raw.trim());
        setValue("title", "Opfølgning på SF-livechat");
      }
      sessionStorage.removeItem(SF_CHAT_TICKET_PREFILL_KEY);
    } catch {
      // ignore private mode / quota
    }
  }, [prefillFromSfChat, setValue]);

  useEffect(() => {
    if (isMajor) {
      setParentTicketId("");
      return;
    }
    let cancelled = false;
    apiGet<Ticket[]>("/api/v1/tickets?is_store=true")
      .then((data) => {
        if (!cancelled) {
          setStoreTickets(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStoreTickets([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isMajor]);

  const subcategories = useMemo(() => {
    const category = categories.find((item) => item.id === categoryId);
    return category?.subcategories ?? [];
  }, [categories, categoryId]);

  const categoryNameDa = useMemo(() => {
    return categories.find((item) => item.id === categoryId)?.name_da;
  }, [categories, categoryId]);

  useEffect(() => {
    setSelectedSubCauseIds([]);
    if (!categoryId) {
      setSubCauses([]);
      return;
    }
    let cancelled = false;
    apiGet<SubCause[]>(`/api/v1/sub-causes?category_id=${categoryId}`)
      .then((data) => {
        if (!cancelled) {
          setSubCauses(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubCauses([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  function toggleSubCause(id: string) {
    setSelectedSubCauseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function applyIntakeDraft(draft: IntakeAssistDraft) {
    setValue("title", draft.title);
    setValue("description", draft.description);
    setValue("priority", draft.suggested_priority);
    setValue("ticket_type", draft.suggested_ticket_type);
    setIntakeAnswers((prev) => ({ ...prev, ...draft.intake_answers }));
    setTagsInput(draft.tags.join(", "));
    setEmoji(draft.emoji);
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    const cpr = values.subject_cpr?.trim() || null;
    const payload: TicketCreateInput = {
      ticket_type: values.ticket_type,
      title: values.title,
      description: values.description,
      priority: values.priority,
      category_id: values.category_id || null,
      subcategory_id: values.subcategory_id || null,
      sub_cause_ids: selectedSubCauseIds,
      is_major: values.is_major,
      parent_ticket_id: values.is_major ? null : parentTicketId || null,
      is_security_ticket: staffOnly ? values.is_security_ticket : false,
      gdpr_consent: Boolean(cpr && values.gdpr_consent),
      subject_cpr: cpr,
      tags: parseTagsInput(tagsInput),
      emoji,
      intake_answers: Object.fromEntries(
        Object.entries(intakeAnswers).filter(([, v]) => v.trim()),
      ),
      ...(staffOnly ? { source: ticketSource } : {}),
    };
    try {
      const ticket = await apiPost<Ticket>("/api/v1/tickets", payload);
      if (attachmentFile) {
        const formData = new FormData();
        formData.append("file", attachmentFile);
        await apiPostForm<Attachment>(
          `/api/v1/tickets/${ticket.id}/attachments`,
          formData,
        );
      }
      router.push(`/tickets/${ticket.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette sagen");
    }
  }

  return (
    <section className="wire-card border-t-[3px] border-t-star-red">
      <h1 className="wire-card-title">Opret ny sag</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Brug AI-assistenten til et udkast, eller udfyld formularen direkte — personoplysninger og
        tags er valgfrie.
      </p>
      <div className="ticket-create-layout">
        <TicketCreateLlmAssistant
          onApplyDraft={applyIntakeDraft}
          disabled={isSubmitting}
        />
        <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-8">
        <section className="space-y-4" aria-labelledby="create-ticket-basics">
          <h2 id="create-ticket-basics" className="wire-card-title">
            Sagens indhold
          </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="wire-form-label" htmlFor="ticket_type">Type</label>
                <select
                  id="ticket_type"
                  className={selectClassName}
                  {...register("ticket_type")}
                >
                  <option value="incident">Incident</option>
                  <option value="service_request">Serviceanmodning</option>
                  <option value="problem">Problem</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="wire-form-label" htmlFor="priority">Prioritet</label>
                <select
                  id="priority"
                  className={selectClassName}
                  {...register("priority")}
                >
                  <option value="low">Lav</option>
                  <option value="medium">Medium</option>
                  <option value="high">Høj</option>
                  <option value="critical">Kritisk</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="wire-form-label" htmlFor="title">Titel</label>
              <Input id="title" className={inputClassName} {...register("title")} />
              {errors.title ? (
                <p className="text-destructive text-sm">{errors.title.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="wire-form-label" htmlFor="description">Beskrivelse</label>
              <Textarea
                id="description"
                rows={6}
                className={textareaClassName}
                {...register("description")}
              />
              {errors.description ? (
                <p className="text-destructive text-sm">{errors.description.message}</p>
              ) : null}
            </div>

            {staffOnly ? (
              <div className="space-y-2">
                <label className="wire-form-label" htmlFor="ticket_source">
                  Kilde
                </label>
                <select
                  id="ticket_source"
                  className={selectClassName}
                  value={ticketSource}
                  onChange={(e) =>
                    setTicketSource(e.target.value as "portal" | "email" | "phone" | "chat")
                  }
                  disabled={isSubmitting}
                >
                  <option value="phone">Telefon</option>
                  <option value="email">E-mail</option>
                  <option value="chat">Chat</option>
                  <option value="portal">Selvbetjening</option>
                </select>
                <p className="text-muted-foreground text-xs">
                  Angiv hvordan sagen kom ind — synlig som &quot;Kilde&quot; på sagen.
                </p>
              </div>
            ) : null}

            <TicketIntakeQuestions
              title={watchedTitle}
              description={watchedDescription}
              categoryName={categoryNameDa}
              answers={intakeAnswers}
              onChange={setIntakeAnswers}
              disabled={isSubmitting}
            />
          </section>

          <section className="space-y-4" aria-labelledby="create-ticket-classify">
            <h2 id="create-ticket-classify" className="wire-card-title">
              Klassificering
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="wire-form-label" htmlFor="category_id">Kategori</label>
                <select
                  id="category_id"
                  className={selectClassName}
                  {...register("category_id")}
                >
                  <option value="">Vælg kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name_da}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="wire-form-label" htmlFor="subcategory_id">Underkategori</label>
                <select
                  id="subcategory_id"
                  className={selectClassName}
                  disabled={subcategories.length === 0}
                  {...register("subcategory_id")}
                >
                  <option value="">Vælg underkategori</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name_da}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="wire-form-label">Underårsager</label>
              {subCauses.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Vælg en kategori for at se underårsager.
                </p>
              ) : (
                <ul className="max-h-40 space-y-2 overflow-y-auto rounded-[2px] border border-[var(--gray-border)] bg-white p-3">
                  {subCauses.map((sc) => (
                    <li key={sc.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        id={`sc-${sc.id}`}
                        checked={selectedSubCauseIds.includes(sc.id)}
                        onChange={() => toggleSubCause(sc.id)}
                        className="size-4 rounded border"
                      />
                      <label htmlFor={`sc-${sc.id}`} className="cursor-pointer">
                        {sc.name_da}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 rounded border" {...register("is_major")} />
              <span>Stor sag (vises i kolonner til højre på forsiden)</span>
            </label>

            {!isMajor && storeTickets.length > 0 ? (
              <div className="space-y-2">
                <label className="wire-form-label" htmlFor="parent_ticket_id">Tilknyt store sag (valgfrit)</label>
                <select
                  id="parent_ticket_id"
                  className={selectClassName}
                  value={parentTicketId}
                  onChange={(e) => setParentTicketId(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Ingen</option>
                  {storeTickets.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.ticket_number} — {store.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {staffOnly ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  {...register("is_security_ticket")}
                />
                <span>Sikkerhedssag</span>
              </label>
            ) : null}

            <TicketTagsEmojiFields
              tagsValue={tagsInput}
              onTagsChange={setTagsInput}
              emojiValue={emoji}
              onEmojiChange={setEmoji}
              disabled={isSubmitting}
            />
          </section>

          <section
            className="space-y-4 rounded-[2px] border border-[var(--gray-border)] bg-[var(--gray-bg)] p-4"
            aria-labelledby="create-ticket-privacy"
          >
            <div>
              <h2 id="create-ticket-privacy" className="wire-card-title">
                Personoplysninger (valgfrit)
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Udfyld kun hvis sagen omhandler en konkret person. GDPR-samtykke kræves kun ved
                CPR-nummer.
              </p>
            </div>

            <div className="space-y-2">
              <label className="wire-form-label" htmlFor="subject_cpr">CPR-nummer</label>
              <Input
                id="subject_cpr"
                className={inputClassName}
                placeholder="DDMMYY-XXXX"
                autoComplete="off"
                {...register("subject_cpr")}
              />
              {errors.subject_cpr ? (
                <p className="text-destructive text-sm">{errors.subject_cpr.message}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  CPR må kun angives her — ikke i titel eller beskrivelse.
                </p>
              )}
            </div>

            {cprFilled ? (
              <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border"
                  {...register("gdpr_consent")}
                />
                <span>
                  Jeg giver samtykke til, at STAR behandler personoplysninger i denne sag i
                  overensstemmelse med GDPR.{" "}
                  <span className="text-destructive font-medium">Påkrævet når CPR er udfyldt.</span>
                </span>
              </label>
            ) : null}
            {errors.gdpr_consent ? (
              <p className="text-destructive text-sm">{errors.gdpr_consent.message}</p>
            ) : null}
          </section>

          <section className="space-y-4" aria-labelledby="create-ticket-attachment">
            <h2 id="create-ticket-attachment" className="wire-card-title">
              Vedhæftning
            </h2>
            <div className="space-y-2">
              <label className="wire-form-label" htmlFor="attachment">Dokument (valgfrit)</label>
              <Input
                id="attachment"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.txt,.doc,.docx"
                onChange={(event) => {
                  setAttachmentFile(event.target.files?.[0] ?? null);
                }}
              />
              <p className="text-muted-foreground text-xs">
                Filen virusscannes før sagsbehandlere kan åbne den. Max 10 MB.
              </p>
            </div>
          </section>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="wire-btn wire-btn-primary w-full sm:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Opretter…" : "Opret sag"}
          </Button>
        </form>
      </div>
    </section>
  );
}
