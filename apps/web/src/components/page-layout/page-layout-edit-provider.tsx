"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { getClientUser, hydrateClientSession } from "@/lib/auth";
import { canEditPageLayout } from "@/lib/page-layout/access";
import { clonePageLayout, pushUndoSnapshot } from "@/lib/page-layout/history";
import {
  mergeFieldConfig,
  pageLayoutKey,
  readPageLayout,
  upsertField,
  writePageLayout,
  PAGE_LAYOUT_CHANGED_EVENT,
} from "@/lib/page-layout/storage";
import type { PageLayoutFieldConfig, PageLayoutPageConfig } from "@/lib/page-layout/types";
import type { User } from "@/types/user";

type PageLayoutEditContextValue = Readonly<{
  canEdit: boolean;
  editMode: boolean;
  setEditMode: (value: boolean) => void;
  pageKey: string;
  getField: (
    fieldId: string,
    defaults: { label: string; order: number; span?: PageLayoutFieldConfig["span"] },
  ) => PageLayoutFieldConfig;
  updateField: (fieldId: string, patch: Partial<PageLayoutFieldConfig>) => void;
  moveField: (fieldId: string, direction: -1 | 1) => void;
  resetPageLayout: () => void;
  undoLayout: () => void;
  canUndo: boolean;
  undoStackDepth: number;
}>;

const PageLayoutEditContext = createContext<PageLayoutEditContextValue | null>(null);

export function usePageLayoutEdit(): PageLayoutEditContextValue {
  const ctx = useContext(PageLayoutEditContext);
  if (!ctx) {
    return {
      canEdit: false,
      editMode: false,
      setEditMode: () => undefined,
      pageKey: "/",
      getField: (_id, defaults) => ({
        label: defaults.label,
        order: defaults.order,
        span: defaults.span ?? "full",
        collapsed: false,
      }),
      updateField: () => undefined,
      moveField: () => undefined,
      resetPageLayout: () => undefined,
      undoLayout: () => undefined,
      canUndo: false,
      undoStackDepth: 0,
    };
  }
  return ctx;
}

export function PageLayoutEditProvider({
  children,
  user: userFromServer,
  canEditFromServer,
}: {
  children: ReactNode;
  user?: User | null;
  /** Server-resolved — avoids hiding control before client session hydrate. */
  canEditFromServer?: boolean;
}) {
  const pathname = usePathname();
  const pageKey = pageLayoutKey(pathname);
  const [sessionUser, setSessionUser] = useState<User | null>(userFromServer ?? null);

  useEffect(() => {
    setSessionUser(userFromServer ?? getClientUser());
    if (userFromServer) {
      return;
    }
    fireAndForget(hydrateClientSession().then((user) => {
      if (user) {
        setSessionUser(user);
      }
    }));
  }, [userFromServer]);

  const user = userFromServer ?? sessionUser ?? getClientUser();
  const canEdit = Boolean(canEditFromServer) || canEditPageLayout(user);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<PageLayoutPageConfig>({ fields: {} });
  const [undoStack, setUndoStack] = useState<PageLayoutPageConfig[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readPageLayout(pageKey);
    setLayout(saved ?? { fields: {} });
    setUndoStack([]);
    setHydrated(true);
  }, [pageKey]);

  useEffect(() => {
    const onChanged = () => {
      setLayout(readPageLayout(pageKey) ?? { fields: {} });
    };
    window.addEventListener(PAGE_LAYOUT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PAGE_LAYOUT_CHANGED_EVENT, onChanged);
  }, [pageKey]);

  useEffect(() => {
    if (!editMode) return;
    const prev = document.body.style.overflow;
    document.body.classList.add("page-layout-edit-active");
    return () => {
      document.body.classList.remove("page-layout-edit-active");
      document.body.style.overflow = prev;
    };
  }, [editMode]);

  const persist = useCallback(
    (next: PageLayoutPageConfig, options?: { recordUndo?: boolean }) => {
      const recordUndo = options?.recordUndo !== false;
      if (recordUndo) {
        setUndoStack((stack) => pushUndoSnapshot(stack, layout));
      }
      setLayout(next);
      writePageLayout(pageKey, next);
    },
    [layout, pageKey],
  );

  const undoLayout = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      if (!previous) return stack;
      const restored = clonePageLayout(previous);
      setLayout(restored);
      writePageLayout(pageKey, restored);
      return stack.slice(0, -1);
    });
  }, [pageKey]);

  useEffect(() => {
    if (!editMode || !canEdit) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undoLayout();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editMode, canEdit, undoLayout]);

  const getField = useCallback(
    (
      fieldId: string,
      defaults: { label: string; order: number; span?: PageLayoutFieldConfig["span"] },
    ) => {
      const span = defaults.span ?? "full";
      if (!hydrated) {
        return { label: defaults.label, order: defaults.order, span, collapsed: false };
      }
      return mergeFieldConfig(layout, fieldId, {
        label: defaults.label,
        order: defaults.order,
        span,
      });
    },
    [hydrated, layout],
  );

  const updateField = useCallback(
    (fieldId: string, patch: Partial<PageLayoutFieldConfig>) => {
      persist(upsertField(layout, fieldId, patch));
    },
    [layout, persist],
  );

  const moveField = useCallback(
    (fieldId: string, direction: -1 | 1) => {
      const current = layout.fields[fieldId];
      if (!current) return;
      updateField(fieldId, { order: current.order + direction * 10 });
    },
    [layout.fields, updateField],
  );

  const resetPageLayout = useCallback(() => {
    persist({ fields: {} });
  }, [persist]);

  const canUndo = undoStack.length > 0;

  const value = useMemo(
    () => ({
      canEdit,
      editMode,
      setEditMode,
      pageKey,
      getField,
      updateField,
      moveField,
      resetPageLayout,
      undoLayout,
      canUndo,
      undoStackDepth: undoStack.length,
    }),
    [
      canEdit,
      editMode,
      pageKey,
      getField,
      updateField,
      moveField,
      resetPageLayout,
      undoLayout,
      canUndo,
      undoStack.length,
    ],
  );

  return (
    <PageLayoutEditContext.Provider value={value}>{children}</PageLayoutEditContext.Provider>
  );
}
