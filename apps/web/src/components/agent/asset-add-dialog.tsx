"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";

import { useAssetCatalog, type AddAssetInput } from "@/components/agent/asset-catalog-context";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { ASSET_CATEGORY_COLORS, type AssetCategorySystemId } from "@/lib/mock-assets";
import { cn } from "@/lib/utils";

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-sm border border-[var(--gray-border)] px-2 text-[12px] outline-none focus-visible:border-star-navy focus-visible:ring-1 focus-visible:ring-star-navy/30";

const inputClassName =
  "border-input bg-background flex h-9 w-full rounded-sm border border-[var(--gray-border)] px-2 text-[12px] outline-none focus-visible:border-star-navy focus-visible:ring-1 focus-visible:ring-star-navy/30";

interface AssetAddDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (assetId: string) => void;
  defaultParentSystemId?: string | null;
}

export function AssetAddDialog({
  open,
  onClose,
  onCreated,
  defaultParentSystemId,
}: AssetAddDialogProps) {
  const titleId = useId();
  const panelRef = useFocusTrap(open, onClose);
  const { systems, addAsset } = useAssetCatalog();

  const [kind, setKind] = useState<AddAssetInput["kind"]>("subsystem");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentSystemId, setParentSystemId] = useState(
    defaultParentSystemId ?? systems[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const id = addAsset({
      kind,
      name,
      code,
      parentSystemId: kind === "subsystem" ? parentSystemId : undefined,
    });
    if (!id) {
      setError("Udfyld navn og kode. Vælg overordnet system for undersystem.");
      return;
    }
    onCreated(id);
    setName("");
    setCode("");
    onClose();
  };

  return (
    <div
      className="wire-confirm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="wire-confirm-modal max-w-[420px]"
      >
        <div className="border-b border-[var(--gray-border)] px-4 py-3.5">
          <h2 id={titleId} className="text-star-navy flex items-center gap-2 text-sm font-bold">
            <Plus className="size-4" aria-hidden />
            Tilføj aktiv
          </h2>
          <p className="text-[var(--gray-mid)] mt-0.5 text-[11px]">
            Prototype — gemmes kun i denne session, indtil aktiver er i databasen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3.5">
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-star-navy mb-1.5 text-[10px] font-bold tracking-wide uppercase">
              Type
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "subsystem" as const, label: "Undersystem" },
                  { value: "system" as const, label: "System (kategori)" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "wire-asset-graph-toggle cursor-pointer",
                    kind === opt.value && "border-star-navy bg-star-blue-light",
                  )}
                >
                  <input
                    type="radio"
                    name="asset-kind"
                    className="sr-only"
                    checked={kind === opt.value}
                    onChange={() => setKind(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="asset-name" className="text-star-navy mb-1 block text-[10px] font-bold">
              Navn
            </label>
            <input
              id="asset-name"
              className={inputClassName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fx Ny mikrotjeneste"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="asset-code" className="text-star-navy mb-1 block text-[10px] font-bold">
              Kode
            </label>
            <input
              id="asset-code"
              className={inputClassName}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FX NY01"
              required
              maxLength={12}
            />
          </div>

          {kind === "subsystem" ? (
            <div>
              <label
                htmlFor="asset-parent"
                className="text-star-navy mb-1 block text-[10px] font-bold"
              >
                Kategori / overordnet system
              </label>
              <select
                id="asset-parent"
                className={selectClassName}
                value={parentSystemId}
                onChange={(e) => setParentSystemId(e.target.value)}
                required
              >
                {systems.map((system) => {
                  const theme =
                    ASSET_CATEGORY_COLORS[system.id as AssetCategorySystemId];
                  const label = theme?.label ?? system.name;
                  return (
                    <option key={system.id} value={system.id}>
                      {label} — {system.name}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}

          {error ? (
            <p className="text-star-red text-[11px] font-medium" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--gray-border)] pt-3">
            <button type="button" className="wire-asset-graph-reset px-3 py-1.5" onClick={onClose}>
              Annuller
            </button>
            <button type="submit" className="wire-asset-detail-action px-3 py-1.5">
              Tilføj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
