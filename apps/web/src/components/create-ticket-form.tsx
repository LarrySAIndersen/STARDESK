"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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
import { Textarea } from "@/components/ui/textarea";
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

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function CreateTicketForm({
  categories,
  staffOnly = false,
}: {
  categories: Category[];
  staffOnly?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [subCauses, setSubCauses] = useState<SubCause[]>([]);
  const [selectedSubCauseIds, setSelectedSubCauseIds] = useState<string[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [storeTickets, setStoreTickets] = useState<Ticket[]>([]);
  const [parentTicketId, setParentTicketId] = useState("");
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
  const isMajor = watch("is_major");
  const subjectCpr = useWatch({ control, name: "subject_cpr" }) ?? "";
  const cprFilled = subjectCpr.trim().length > 0;

  useEffect(() => {
    if (!cprFilled) {
      setValue("gdpr_consent", false);
    }
  }, [cprFilled, setValue]);

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
    <Card className="star-section-card overflow-hidden border-t-4 border-t-star-blue">
      <CardHeader className="bg-star-blue-light border-b">
        <CardTitle className="text-star-navy">Opret ny sag</CardTitle>
        <CardDescription>
          Beskriv sagen først — personoplysninger og tags er valgfrie.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <section className="space-y-4" aria-labelledby="create-ticket-basics">
            <h2 id="create-ticket-basics" className="text-star-navy text-sm font-semibold">
              Sagens indhold
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ticket_type">Type</Label>
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
                <Label htmlFor="priority">Prioritet</Label>
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
              <Label htmlFor="title">Titel</Label>
              <Input id="title" {...register("title")} />
              {errors.title ? (
                <p className="text-destructive text-sm">{errors.title.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beskrivelse</Label>
              <Textarea id="description" rows={6} {...register("description")} />
              {errors.description ? (
                <p className="text-destructive text-sm">{errors.description.message}</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-4" aria-labelledby="create-ticket-classify">
            <h2 id="create-ticket-classify" className="text-star-navy text-sm font-semibold">
              Klassificering
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category_id">Kategori</Label>
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
                <Label htmlFor="subcategory_id">Underkategori</Label>
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
              <Label>Underårsager</Label>
              {subCauses.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Vælg en kategori for at se underårsager.
                </p>
              ) : (
                <ul className="border-input max-h-40 space-y-2 overflow-y-auto rounded-md border bg-white p-3">
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
                <Label htmlFor="parent_ticket_id">Tilknyt store sag (valgfrit)</Label>
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
            className="border-muted bg-muted/30 space-y-4 rounded-lg border p-4"
            aria-labelledby="create-ticket-privacy"
          >
            <div>
              <h2 id="create-ticket-privacy" className="text-star-navy text-sm font-semibold">
                Personoplysninger (valgfrit)
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Udfyld kun hvis sagen omhandler en konkret person. GDPR-samtykke kræves kun ved
                CPR-nummer.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject_cpr">CPR-nummer</Label>
              <Input
                id="subject_cpr"
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
            <h2 id="create-ticket-attachment" className="text-star-navy text-sm font-semibold">
              Vedhæftning
            </h2>
            <div className="space-y-2">
              <Label htmlFor="attachment">Dokument (valgfrit)</Label>
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
            className="bg-star-blue hover:bg-star-navy w-full rounded-sm font-semibold sm:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Opretter…" : "Opret sag"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
