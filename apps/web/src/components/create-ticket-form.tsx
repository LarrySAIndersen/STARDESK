"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { apiPost } from "@/lib/api";
import type { Category } from "@/types/category";
import type { Ticket, TicketCreateInput } from "@/types/ticket";

const schema = z.object({
  ticket_type: z.enum(["service_request", "incident", "problem"]),
  title: z.string().min(3, "Titel skal være mindst 3 tegn"),
  description: z.string().min(10, "Beskrivelse skal være mindst 10 tegn"),
  priority: z.enum(["critical", "high", "medium", "low"]),
  category_id: z.string().optional(),
  subcategory_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function CreateTicketForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
    },
  });

  const categoryId = watch("category_id");
  const subcategories = useMemo(() => {
    const category = categories.find((item) => item.id === categoryId);
    return category?.subcategories ?? [];
  }, [categories, categoryId]);

  async function onSubmit(values: FormValues) {
    setError(null);
    const payload: TicketCreateInput = {
      ticket_type: values.ticket_type,
      title: values.title,
      description: values.description,
      priority: values.priority,
      category_id: values.category_id || null,
      subcategory_id: values.subcategory_id || null,
    };
    try {
      const ticket = await apiPost<Ticket>("/api/v1/tickets", payload);
      router.push(`/tickets/${ticket.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette sagen");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opret ny sag</CardTitle>
        <CardDescription>
          Udfyld felterne — sagen routes automatisk til det rigtige team.
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
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea id="description" rows={6} {...register("description")} />
            {errors.description ? (
              <p className="text-destructive text-sm">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Opretter…" : "Opret sag"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

