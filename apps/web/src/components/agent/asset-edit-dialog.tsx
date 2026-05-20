"use client";

import { useEffect, useId, useState } from "react";
import { Pencil } from "lucide-react";

import {
  useAssetCatalog,
  type UpdateAssetInput,
} from "@/components/agent/asset-catalog-context";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { AssetDetail, AssetEnvironment, AssetStatus } from "@/types/asset";
import { cn } from "@/lib/utils";

const inputClassName =
  "border-input bg-background flex h-9 w-full rounded-sm border border-[var(--gray-border)] px-2 text-[12px] outline-none focus-visible:border-star-navy focus-visible:ring-1 focus-visible:ring-star-navy/30";

const selectClassName = inputClassName;

const STATUSES: AssetStatus[] = ["I drift", "Planlagt", "Nedlagt"];
const ENVIRONMENTS: AssetEnvironment[] = ["Produktion", "Test"];

interface AssetEditDialogProps {
  open: boolean;
  detail: AssetDetail | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: (assetId: string) => void;
}

export function AssetEditDialog({
  open,
  detail,
  onClose,
  onSaved,
  onDeleted,
}: AssetEditDialogProps) {
  const titleId = useId();
  const panelRef = useFocusTrap(open, onClose);
  const { updateAsset, deleteAsset, isCustomAsset } = useAssetCatalog();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<AssetStatus>("I drift");
  const [ownerTeam, setOwnerTeam] = useState("");
  const [environment, setEnvironment] = useState<AssetEnvironment>("Produktion");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) return;
    setName(detail.name);
    setCode(detail.code);
    setStatus(detail.status);
    setOwnerTeam(detail.ownerTeam);
    setEnvironment(detail.environment);
    setDescription(detail.description);
    setError(null);
  }, [detail]);

  if (!open || !detail) return null;

  const canDelete = isCustomAsset(detail.id);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const patch: UpdateAssetInput = {
      name,
      code,
      status,
      ownerTeam,
      environment,
      description,
    };
    if (!updateAsset(detail.id, patch)) {
      setError("Kunne ikke gemme aktivet.");
      return;
    }
    onSaved();
    onClose();
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (!window.confirm(`Slet aktivet «${detail.name}»?`)) return;
    if (deleteAsset(detail.id)) {
      onDeleted?.(detail.id);
      onClose();
    }
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
        className="wire-confirm-modal max-w-[440px]"
      >
        <div className="border-b border-[var(--gray-border)] px-4 py-3.5">
          <h2 id={titleId} className="text-star-navy flex items-center gap-2 text-sm font-bold">
            <Pencil className="size-4" aria-hidden />
            Rediger aktiv
          </h2>
          <p className="text-[var(--gray-mid)] mt-0.5 text-[11px]">
            Kun administratorer. Ændringer gemmes i browseren indtil CMDB er i databasen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3.5">
          <div>
            <label htmlFor="edit-asset-name" className="text-star-navy mb-1 block text-[10px] font-bold">
              Navn
            </label>
            <input
              id="edit-asset-name"
              className={inputClassName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="edit-asset-code" className="text-star-navy mb-1 block text-[10px] font-bold">
              Kode
            </label>
            <input
              id="edit-asset-code"
              className={inputClassName}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              maxLength={12}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-asset-status" className="text-star-navy mb-1 block text-[10px] font-bold">
                Status
              </label>
              <select
                id="edit-asset-status"
                className={selectClassName}
                value={status}
                onChange={(e) => setStatus(e.target.value as AssetStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="edit-asset-env"
                className="text-star-navy mb-1 block text-[10px] font-bold"
              >
                Miljø
              </label>
              <select
                id="edit-asset-env"
                className={selectClassName}
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as AssetEnvironment)}
              >
                {ENVIRONMENTS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="edit-asset-owner" className="text-star-navy mb-1 block text-[10px] font-bold">
              Ejer / team
            </label>
            <input
              id="edit-asset-owner"
              className={inputClassName}
              value={ownerTeam}
              onChange={(e) => setOwnerTeam(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="edit-asset-desc"
              className="text-star-navy mb-1 block text-[10px] font-bold"
            >
              Beskrivelse
            </label>
            <textarea
              id="edit-asset-desc"
              className={cn(inputClassName, "min-h-[72px] py-2")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error ? (
            <p className="text-star-red text-[11px] font-medium" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--gray-border)] pt-3">
            {canDelete ? (
              <button
                type="button"
                className="text-star-red text-[11px] font-semibold hover:underline"
                onClick={handleDelete}
              >
                Slet aktiv
              </button>
            ) : (
              <span className="text-[var(--gray-mid)] text-[10px]">Standardaktiver kan ikke slettes</span>
            )}
            <div className="flex gap-2">
              <button type="button" className="wire-asset-graph-reset px-3 py-1.5" onClick={onClose}>
                Annuller
              </button>
              <button type="submit" className="wire-asset-detail-action px-3 py-1.5">
                Gem
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
