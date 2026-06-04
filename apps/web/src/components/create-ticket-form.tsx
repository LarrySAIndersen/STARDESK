"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { CreateTicketOptionalSection } from "@/components/create-ticket-optional-section";
import {
  PageLayoutFormField,
  PageLayoutGrid,
  PageLayoutSection,
} from "@/components/page-layout/page-layout-field";
import { pageLayoutSagaActiveClass } from "@/components/page-layout/page-layout-edit-saga-indicator";
import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TicketCreateLlmAssistant,
  type IntakeAssistDraft,
} from "@/components/ticket-create-llm-assistant";
import { TicketIntakeQuestions, type IntakeAnswers } from "@/components/ticket-intake-questions";
import { TicketTagsEmojiFields } from "@/components/ticket-tags-emoji-fields";
import { UserMultiSelect } from "@/components/user-multi-select";
import { assertNoCprInFreeText, validateCprOptional } from "@/lib/cpr";
import { parseTagsInput } from "@/lib/ticket-tags";
import {
  PendingImageAttachments,
  usePendingImageAttachments,
} from "@/components/pending-image-attachments";
import { dispatchBoardTicketsChanged } from "@/hooks/use-board-data-sync";
import { apiGet, apiPost } from "@/lib/api";
import { uploadTicketAttachments } from "@/lib/upload-ticket-attachments";
import type { Category } from "@/types/category";
import type { SubCause } from "@/types/sub-cause";
import type { Team } from "@/types/team";
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
  teams = [],
  staffOnly = false,
  prefillFromSfChat = false,
}: {
  categories: Category[];
  teams?: Team[];
  staffOnly?: boolean;
  /** When true, read transcript from sessionStorage (set by SF chat widget). */
  prefillFromSfChat?: boolean;
}) {
  const router = useRouter();
  const { canEdit, editMode } = usePageLayoutEdit();
  const [error, setError] = useState<string | null>(null);
  const [subCauses, setSubCauses] = useState<SubCause[]>([]);
  const [selectedSubCauseIds, setSelectedSubCauseIds] = useState<string[]>([]);
  const {
    files: pendingAttachments,
    onPaste: onDescriptionPaste,
    removeAt: removeAttachmentAt,
    addFiles: addAttachments,
  } = usePendingImageAttachments();
  const [tagsInput, setTagsInput] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers>({});
  const [storeTickets, setStoreTickets] = useState<Ticket[]>([]);
  const [parentTicketId, setParentTicketId] = useState("");
  const [ticketSource, setTicketSource] = useState<"portal" | "email" | "phone" | "chat">("phone");
  const [affectedUserIds, setAffectedUserIds] = useState<string[]>([]);
  const [interestedUserIds, setInterestedUserIds] = useState<string[]>([]);
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
      ...(staffOnly && affectedUserIds.length > 0 ? { affected_user_ids: affectedUserIds } : {}),
      ...(staffOnly && interestedUserIds.length > 0
        ? { interested_user_ids: interestedUserIds }
        : {}),
    };
    try {
      const ticket = await apiPost<Ticket>("/api/v1/tickets", payload);
      if (pendingAttachments.length > 0) {
        await uploadTicketAttachments(ticket.id, pendingAttachments);
      }
      dispatchBoardTicketsChanged();
      router.push(`/tickets/${ticket.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette sagen");
    }
  }

  return (
    <section
      className={pageLayoutSagaActiveClass(
        canEdit,
        editMode,
        "wire-card border-t-[3px] border-t-star-red",
      )}
    >
      <header className="mb-6">
        <h1 id="create-ticket-heading" className="wire-card-title">
          Ny sag
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Beskriv problemet med titel og beskrivelse — alt andet er valgfrit og kan udfyldes
          bagefter.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="min-w-0"
        aria-labelledby="create-ticket-heading"
        noValidate
      >
        <PageLayoutGrid className="space-y-5">
          <PageLayoutSection
            fieldId="section-basics"
            defaultLabel="Det vigtigste"
            defaultOrder={10}
            contentClassName="ticket-create-primary space-y-5 rounded-[2px] border border-[var(--gray-border)] bg-[var(--gray-bg)]/40 p-5"
          >
            <PageLayoutFormField
              fieldId="field-title"
              defaultLabel="Titel"
              defaultOrder={11}
              htmlFor="title"
            >
              <Input
                id="title"
                className={inputClassName}
                required
                aria-required="true"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "title-error" : undefined}
                placeholder="Fx VPN virker ikke hjemmefra"
                {...register("title")}
              />
              {errors.title ? (
                <p id="title-error" className="text-destructive text-sm" role="alert">
                  {errors.title.message}
                </p>
              ) : null}
            </PageLayoutFormField>

            <PageLayoutFormField
              fieldId="field-description"
              defaultLabel="Beskrivelse"
              defaultOrder={12}
              htmlFor="description"
            >
              <Textarea
                id="description"
                rows={5}
                className={textareaClassName}
                required
                aria-required="true"
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={errors.description ? "description-error" : undefined}
                placeholder="Hvad skete der, hvornår, og hvad har I allerede prøvet?"
                {...register("description")}
                onPaste={(event) => {
                  onDescriptionPaste(event);
                }}
              />
              <PendingImageAttachments
                files={pendingAttachments}
                onRemove={removeAttachmentAt}
              />
              {errors.description ? (
                <p id="description-error" className="text-destructive text-sm" role="alert">
                  {errors.description.message}
                </p>
              ) : null}
            </PageLayoutFormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <PageLayoutFormField
                fieldId="field-type"
                defaultLabel="Type"
                defaultOrder={13}
                defaultSpan="half"
                htmlFor="ticket_type"
              >
                <select
                  id="ticket_type"
                  className={selectClassName}
                  {...register("ticket_type")}
                >
                  <option value="incident">Hændelse</option>
                  <option value="service_request">Serviceanmodning</option>
                  <option value="problem">Problem</option>
                </select>
              </PageLayoutFormField>
              <PageLayoutFormField
                fieldId="field-priority"
                defaultLabel="Prioritet"
                defaultOrder={14}
                defaultSpan="half"
                htmlFor="priority"
              >
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
              </PageLayoutFormField>
            </div>
          </PageLayoutSection>

          <PageLayoutSection
            fieldId="section-optional"
            defaultLabel="Valgfrit"
            defaultOrder={20}
            contentClassName="space-y-3"
          >
            <CreateTicketOptionalSection
              title="Klassificering"
              description="Kategori, underkategori, tags og underårsager"
            >
            <div className="grid gap-4 sm:grid-cols-2">
              <PageLayoutFormField
                fieldId="field-category"
                defaultLabel="Kategori"
                defaultOrder={21}
                defaultSpan="half"
                htmlFor="category_id"
              >
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
              </PageLayoutFormField>
              <PageLayoutFormField
                fieldId="field-subcategory"
                defaultLabel="Underkategori"
                defaultOrder={22}
                defaultSpan="half"
                htmlFor="subcategory_id"
              >
                <select
                  id="subcategory_id"
                  className={selectClassName}
                  disabled={subcategories.length === 0}
                  aria-describedby="subcategory-hint"
                  {...register("subcategory_id")}
                >
                  <option value="">Vælg underkategori</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name_da}
                    </option>
                  ))}
                </select>
                <p id="subcategory-hint" className="text-muted-foreground text-xs">
                  {subcategories.length === 0
                    ? "Vælg først en kategori for at se underkategorier."
                    : "Valgfrit — præciserer klassificeringen."}
                </p>
              </PageLayoutFormField>
            </div>

            <PageLayoutFormField
              fieldId="field-subcauses"
              defaultLabel="Underårsager"
              defaultOrder={23}
            >
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
            </PageLayoutFormField>

            <PageLayoutFormField
              fieldId="field-tags"
              defaultLabel="Tags og emoji"
              defaultOrder={29}
            >
              <TicketTagsEmojiFields
                tagsValue={tagsInput}
                onTagsChange={setTagsInput}
                emojiValue={emoji}
                onEmojiChange={setEmoji}
                disabled={isSubmitting}
              />
            </PageLayoutFormField>
            </CreateTicketOptionalSection>

            <CreateTicketOptionalSection
              title="Hurtige afklaringer"
              description="Korte spørgsmål der hjælper med at prioritere sagen"
            >
              <PageLayoutFormField
                fieldId="field-intake"
                defaultLabel="Afklaringer"
                defaultOrder={16}
              >
                <TicketIntakeQuestions
                  title={watchedTitle}
                  description={watchedDescription}
                  categoryName={categoryNameDa}
                  answers={intakeAnswers}
                  onChange={setIntakeAnswers}
                  disabled={isSubmitting}
                />
              </PageLayoutFormField>
            </CreateTicketOptionalSection>

            {staffOnly ? (
              <CreateTicketOptionalSection
                title="Sagsadministration"
                description="Kilde, berørte brugere, stor sag og sikkerhed"
              >
                <PageLayoutFormField
                  fieldId="field-source"
                  defaultLabel="Kilde"
                  defaultOrder={15}
                  htmlFor="ticket_source"
                >
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
                </PageLayoutFormField>

                <PageLayoutFormField
                  fieldId="field-major"
                  defaultLabel="Stor sag"
                  defaultOrder={24}
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      {...register("is_major")}
                    />
                    <span>Stor sag (vises i kolonner til højre på forsiden)</span>
                  </label>
                </PageLayoutFormField>

                {!isMajor && storeTickets.length > 0 ? (
                  <PageLayoutFormField
                    fieldId="field-parent"
                    defaultLabel="Tilknyt store sag (valgfrit)"
                    defaultOrder={25}
                    htmlFor="parent_ticket_id"
                  >
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
                  </PageLayoutFormField>
                ) : null}

                <PageLayoutFormField
                  fieldId="field-security"
                  defaultLabel="Sikkerhedssag"
                  defaultOrder={26}
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      {...register("is_security_ticket")}
                    />
                    <span>Sikkerhedssag</span>
                  </label>
                </PageLayoutFormField>

                {teams.length > 0 ? (
                  <>
                    <PageLayoutFormField
                      fieldId="field-affected-users"
                      defaultLabel="Berørte brugere"
                      defaultOrder={27}
                    >
                      <UserMultiSelect
                        teams={teams}
                        selectedUserIds={affectedUserIds}
                        onChange={setAffectedUserIds}
                        placeholder="Søg bruger til berørte…"
                        disabled={isSubmitting}
                      />
                    </PageLayoutFormField>
                    <PageLayoutFormField
                      fieldId="field-interested-users"
                      defaultLabel="Interessenter"
                      defaultOrder={28}
                    >
                      <UserMultiSelect
                        teams={teams}
                        selectedUserIds={interestedUserIds}
                        onChange={setInterestedUserIds}
                        placeholder="Søg bruger til interessenter…"
                        disabled={isSubmitting}
                      />
                    </PageLayoutFormField>
                  </>
                ) : null}
              </CreateTicketOptionalSection>
            ) : null}

            <CreateTicketOptionalSection
              title="Personoplysninger"
              description="Kun hvis sagen omhandler en konkret person med CPR"
            >
              <PageLayoutFormField
                fieldId="field-cpr"
                defaultLabel="CPR-nummer"
                defaultOrder={31}
                htmlFor="subject_cpr"
              >
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
              </PageLayoutFormField>

              {cprFilled ? (
                <PageLayoutFormField
                  fieldId="field-gdpr"
                  defaultLabel="GDPR-samtykke"
                  defaultOrder={32}
                >
                  <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border"
                      {...register("gdpr_consent")}
                    />
                    <span>
                      Jeg giver samtykke til, at STAR behandler personoplysninger i denne sag i
                      overensstemmelse med GDPR.{" "}
                      <span className="text-destructive font-medium">
                        Påkrævet når CPR er udfyldt.
                      </span>
                    </span>
                  </label>
                  {errors.gdpr_consent ? (
                    <p className="text-destructive text-sm">{errors.gdpr_consent.message}</p>
                  ) : null}
                </PageLayoutFormField>
              ) : null}
            </CreateTicketOptionalSection>

            <CreateTicketOptionalSection
              title="Vedhæftninger"
              description="Filer eller billeder — du kan også indsætte billeder med Ctrl+V i beskrivelsen"
            >
              <PageLayoutFormField
                fieldId="field-attachment"
                defaultLabel="Dokument"
                defaultOrder={41}
                htmlFor="attachment"
              >
                <Input
                  id="attachment"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.doc,.docx,image/*"
                  multiple
                  onChange={(event) => {
                    const chosen = event.target.files;
                    if (chosen?.length) {
                      addAttachments([...chosen]);
                    }
                    event.target.value = "";
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  Max 10 MB pr. fil. Filer virusscannes før sagsbehandlere kan åbne dem.
                </p>
              </PageLayoutFormField>
            </CreateTicketOptionalSection>

            <CreateTicketOptionalSection
              title="AI-assistent"
              description="Få hjælp til at udarbejde et udkast — valgfrit"
            >
              <TicketCreateLlmAssistant
                onApplyDraft={applyIntakeDraft}
                disabled={isSubmitting}
                embedded
              />
            </CreateTicketOptionalSection>
          </PageLayoutSection>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-[var(--gray-border)] pt-5 sm:flex-row sm:items-center">
            <Button
              type="submit"
              className="wire-btn wire-btn-primary min-h-11 w-full sm:w-auto sm:min-w-[10rem]"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Opretter sag…" : "Opret sag"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="wire-btn min-h-11 w-full sm:w-auto"
              disabled={isSubmitting}
              onClick={() => router.push("/tickets")}
            >
              Annuller
            </Button>
          </div>
        </PageLayoutGrid>
      </form>
    </section>
  );
}
