"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
import { assertNoCprInFreeText, validateCprOptional } from "@/lib/cpr";
import { apiGet, apiPost, apiPostForm } from "@/lib/api";
import type { Attachment } from "@/types/attachment";
import type { Category } from "@/types/category";
import type { SubCause } from "@/types/sub-cause";
import type { Ticket, TicketCreateInput } from "@/types/ticket";

const schema = z.object({
  ticket_type: z.enum(["service_request", "incident", "problem"]),
  title: z.string().min(3, "Titel skal være mindst 3 tegn"),
  description: z.string().min(10, "Beskrivelse skal være mindst 10 tegn"),
  priority: z.enum(["critical", "high", "medium", "low"]),
  category_id: z.string().optional(),
  subcategory_id: z.string().optional(),
  is_major: z.boolean(),
  gdpr_consent: z.boolean().refine((value) => value, {
    message: "Du skal acceptere behandling af personoplysninger (GDPR)",
  }),
  subject_cpr: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      const result = validateCprOptional(value);
      if (result !== true) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result });
      }
    }),
}).superRefine((data, ctx) => {
  const textCheck = assertNoCprInFreeText(data.title, data.description);
  if (textCheck !== true) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: textCheck, path: ["description"] });
  }
});

type FormValues = z.infer<typeof schema>;

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function CreateTicketForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [subCauses, setSubCauses] = useState<SubCause[]>([]);
  const [selectedSubCauseIds, setSelectedSubCauseIds] = useState<string[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ticket_type: "incident",
      priority: "medium",
      is_major: false,
      gdpr_consent: false,
    },
  });

  const categoryId = watch("category_id");
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
    const payload: TicketCreateInput = {
      ticket_type: values.ticket_type,
      title: values.title,
      description: values.description,
      priority: values.priority,
      category_id: values.category_id || null,
      subcategory_id: values.subcategory_id || null,
      sub_cause_ids: selectedSubCauseIds,
      is_major: values.is_major,
      gdpr_consent: true,
      subject_cpr: values.subject_cpr?.trim() || null,
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
          Vælg kategori og underårsager — store sager vises i kolonner på forsiden.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <ul className="border-input max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
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

          <div className="space-y-2">
            <Label htmlFor="subject_cpr">CPR-nummer (valgfrit)</Label>
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

          <div className="space-y-2">
            <Label htmlFor="attachment">Vedhæft dokument (valgfrit)</Label>
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

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border"
              {...register("gdpr_consent")}
            />
            <span>
              Jeg giver samtykke til, at STAR behandler personoplysninger i denne sag i
              overensstemmelse med GDPR (påkrævet).
            </span>
          </label>
          {errors.gdpr_consent ? (
            <p className="text-destructive text-sm">{errors.gdpr_consent.message}</p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea id="description" rows={6} {...register("description")} />
            {errors.description ? (
              <p className="text-destructive text-sm">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <Button
            type="submit"
            className="bg-star-blue hover:bg-star-navy rounded-sm font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Opretter…" : "Opret sag"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
