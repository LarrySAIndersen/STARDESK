"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

type SubcategoryRow = Readonly<{
  id: string;
  category_id: string;
  name: string;
  name_da: string;
  sort_order: number;
  is_active: boolean;
}>;

type CategoryRow = Readonly<{
  id: string;
  name: string;
  name_da: string;
  sort_order: number;
  is_active: boolean;
  subcategories: SubcategoryRow[];
}>;

type SyncResult = Readonly<{
  categories_created: number;
  subcategories_created: number;
  categories_total: number;
}>;

function replaceSubcategoryInCategories(
  categories: CategoryRow[],
  updated: SubcategoryRow,
): CategoryRow[] {
  return categories.map((category) =>
    category.id === updated.category_id
      ? {
          ...category,
          subcategories: category.subcategories.map((sub) =>
            sub.id === updated.id ? updated : sub,
          ),
        }
      : category,
  );
}

type FillResult = Readonly<{
  ticket_count: number;
  updated_count: number;
  dry_run: boolean;
  category_name: string;
  subcategory_name: string;
}>;

const emptyCategory = {
  name: "ny_kategori",
  name_da: "Ny kategori",
  sort_order: 500,
};

const emptySub = (categoryId: string) => ({
  category_id: categoryId,
  name: "ny_underkategori",
  name_da: "Ny underkategori",
  sort_order: 50,
});

export function AdminCategoriesPanel() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState(emptyCategory);
  const [showNewCat, setShowNewCat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiGet<CategoryRow[]>("/api/v1/admin/categories");
      setCategories(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente kategorier");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fireAndForget(load());
  }, [load]);

  async function saveCategory(cat: CategoryRow) {
    setMessage(null);
    setError(null);
    try {
      const updated = await apiPatch<CategoryRow>(`/api/v1/admin/categories/${cat.id}`, {
        name: cat.name,
        name_da: cat.name_da,
        sort_order: cat.sort_order,
        is_active: cat.is_active,
      });
      setCategories((prev) =>
        prev.map((c) =>
          c.id === updated.id ? { ...updated, subcategories: c.subcategories } : c,
        ),
      );
      setMessage(`Gemte kategori «${updated.name_da}»`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme kategori");
    }
  }

  async function saveSubcategory(sub: SubcategoryRow) {
    setMessage(null);
    setError(null);
    try {
      const updated = await apiPatch<SubcategoryRow>(
        `/api/v1/admin/categories/subcategories/${sub.id}`,
        {
          name: sub.name,
          name_da: sub.name_da,
          sort_order: sub.sort_order,
          is_active: sub.is_active,
        },
      );
      setCategories((prev) => replaceSubcategoryInCategories(prev, updated));
      setMessage(`Gemte underkategori «${updated.name_da}»`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme underkategori");
    }
  }

  async function createCategory() {
    setError(null);
    try {
      const created = await apiPost<CategoryRow>("/api/v1/admin/categories", {
        ...newCat,
        is_active: true,
      });
      setCategories((prev) => [...prev, { ...created, subcategories: [] }].sort(
        (a, b) => a.sort_order - b.sort_order,
      ));
      setShowNewCat(false);
      setNewCat(emptyCategory);
      setMessage(`Oprettede «${created.name_da}»`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette kategori");
    }
  }

  async function createSubcategory(categoryId: string) {
    setError(null);
    const draft = emptySub(categoryId);
    try {
      const created = await apiPost<SubcategoryRow>(
        "/api/v1/admin/categories/subcategories",
        { ...draft, is_active: true },
      );
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, subcategories: [...c.subcategories, created] }
            : c,
        ),
      );
      setMessage(`Oprettede underkategori «${created.name_da}» — rediger navn og gem`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette underkategori");
    }
  }

  async function syncDefaults() {
    setError(null);
    try {
      const result = await apiPost<SyncResult>("/api/v1/admin/categories/sync-defaults", {});
      setMessage(
        `Synkroniseret: ${result.categories_created} nye kategorier, ${result.subcategories_created} nye underkategorier (${result.categories_total} i alt)`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Synkronisering fejlede");
    }
  }

  async function fillTickets(dryRun: boolean) {
    setError(null);
    try {
      const result = await apiPost<FillResult>(
        `/api/v1/admin/categories/fill-tickets?dry_run=${dryRun ? "true" : "false"}`,
        {},
      );
      if (dryRun) {
        setMessage(
          `${result.ticket_count} sager mangler kategori (ville sættes til ${result.category_name} / ${result.subcategory_name})`,
        );
      } else {
        setMessage(
          `Udfyldte kategori på ${result.updated_count} sager (${result.category_name} / ${result.subcategory_name})`,
        );
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Udfyldning fejlede");
    }
  }

  function patchCategory(id: string, patch: Partial<CategoryRow>) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function patchSub(categoryId: string, subId: string, patch: Partial<SubcategoryRow>) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              subcategories: c.subcategories.map((s) =>
                s.id === subId ? { ...s, ...patch } : s,
              ),
            }
          : c,
      ),
    );
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Henter kategorier…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-star-red text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-green-800">{message}</p> : null}

      <section className="wire-card flex flex-wrap gap-2">
        <Button type="button" onClick={() => fireAndForget(syncDefaults())}>
          Synkroniser standardkategorier
        </Button>
        <Button type="button" variant="outline" onClick={() => fireAndForget(fillTickets(true))}>
          Tæl sager uden kategori
        </Button>
        <Button type="button" variant="outline" onClick={() => fireAndForget(fillTickets(false))}>
          Udfyld manglende på alle sager
        </Button>
        <Button type="button" variant="outline" onClick={() => setShowNewCat((v) => !v)}>
          {showNewCat ? "Annuller ny kategori" : "Ny kategori"}
        </Button>
      </section>

      {showNewCat ? (
        <section className="wire-card space-y-3">
          <h2 className="wire-card-title">Opret kategori</h2>
          <p className="text-muted-foreground text-xs">
            Teknisk navn: små bogstaver, tal og underscore (fx <code>it_support</code>).
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="new-cat-name">Teknisk navn</Label>
              <Input
                id="new-cat-name"
                value={newCat.name}
                onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="new-cat-da">Visningsnavn (DA)</Label>
              <Input
                id="new-cat-da"
                value={newCat.name_da}
                onChange={(e) => setNewCat((c) => ({ ...c, name_da: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="new-cat-sort">Sortering</Label>
              <Input
                id="new-cat-sort"
                type="number"
                value={newCat.sort_order}
                onChange={(e) =>
                  setNewCat((c) => ({ ...c, sort_order: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
          <Button type="button" onClick={() => fireAndForget(createCategory())}>
            Opret
          </Button>
        </section>
      ) : null}

      <section className="space-y-3">
        {categories.map((cat) => {
          const open = expandedId === cat.id;
          return (
            <article key={cat.id} className="wire-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  className="text-star-navy text-left text-sm font-semibold hover:underline"
                  onClick={() => setExpandedId(open ? null : cat.id)}
                >
                  {open ? "▼" : "▶"} {cat.name_da}{" "}
                  <span className="text-muted-foreground font-normal">({cat.name})</span>
                </button>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={cat.is_active}
                    onChange={(e) => patchCategory(cat.id, { is_active: e.target.checked })}
                  />
                  <span>Aktiv</span>
                </label>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Teknisk navn</Label>
                  <Input
                    value={cat.name}
                    onChange={(e) => patchCategory(cat.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Visningsnavn</Label>
                  <Input
                    value={cat.name_da}
                    onChange={(e) => patchCategory(cat.id, { name_da: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Sortering</Label>
                  <Input
                    type="number"
                    value={cat.sort_order}
                    onChange={(e) =>
                      patchCategory(cat.id, { sort_order: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" size="sm" onClick={() => fireAndForget(saveCategory(cat))}>
                    Gem kategori
                  </Button>
                </div>
              </div>

              {open ? (
                <div className="mt-4 border-t border-[var(--gray-border)] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Underkategorier ({cat.subcategories.length})
                    </h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fireAndForget(createSubcategory(cat.id))}
                    >
                      + Underkategori
                    </Button>
                  </div>
                  <ul className="space-y-3">
                    {cat.subcategories.map((sub) => (
                      <li
                        key={sub.id}
                        className="rounded border border-[var(--gray-border)]/80 bg-[var(--gray-bg)]/40 p-3"
                      >
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div>
                            <Label className="text-xs">Teknisk navn</Label>
                            <Input
                              value={sub.name}
                              onChange={(e) =>
                                patchSub(cat.id, sub.id, { name: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Visningsnavn</Label>
                            <Input
                              value={sub.name_da}
                              onChange={(e) =>
                                patchSub(cat.id, sub.id, { name_da: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Sortering</Label>
                            <Input
                              type="number"
                              value={sub.sort_order}
                              onChange={(e) =>
                                patchSub(cat.id, sub.id, {
                                  sort_order: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="flex flex-col justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={sub.is_active}
                                onChange={(e) =>
                                  patchSub(cat.id, sub.id, { is_active: e.target.checked })
                                }
                              />
                              <span>Aktiv</span>
                            </label>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => fireAndForget(saveSubcategory(sub))}
                            >
                              Gem
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
