"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import {
  AdminUserDialogPanel,
  AdminUserModalBackdrop,
} from "@/components/admin-user-dialog-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiGet } from "@/lib/api";
import { setClientSessionCache } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { UserAdminListItem, UserAdminListResponse } from "@/types/admin-user";
import type { User } from "@/types/user";

async function fetchUsersForImpersonation(search: string): Promise<UserAdminListItem[]> {
  const params = new URLSearchParams({ page: "1", page_size: "100" });
  if (search.trim()) {
    params.set("q", search.trim());
  }
  const first = await apiGet<UserAdminListResponse>(`/api/v1/users?${params}`);
  const items = [...first.items];
  let page = 2;
  while (items.length < first.total && page <= Math.ceil(first.total / first.page_size)) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("page", String(page));
    const next = await apiGet<UserAdminListResponse>(`/api/v1/users?${nextParams}`);
    items.push(...next.items);
    page += 1;
  }
  return items.filter((item) => item.is_active);
}

export function ImpersonateUserDialog({
  currentUser,
  onClose,
}: {
  currentUser: User;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useFocusTrap(true, onClose);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserAdminListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadUsers = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchUsersForImpersonation(query);
      setUsers(items.filter((item) => item.id !== currentUser.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente brugere");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fireAndForget(loadUsers(search));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [loadUsers, search]);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        a.display_name.localeCompare(b.display_name, "da", { sensitivity: "base" }),
      ),
    [users],
  );

  async function onImpersonate(target: UserAdminListItem) {
    setSubmittingId(target.id);
    setError(null);
    try {
      const response = await fetch("/api/auth/impersonate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ user_id: target.id }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? "Kunne ikke impersonere bruger");
      }
      const body = (await response.json()) as { user?: User };
      if (body.user) {
        setClientSessionCache(body.user);
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke impersonere bruger");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <AdminUserModalBackdrop onClose={onClose}>
      <AdminUserDialogPanel
        ref={panelRef}
        titleId={titleId}
        title="Se som anden bruger"
        onClose={onClose}
      >
        <p className="text-muted-foreground text-sm">
          Vælg en bruger for at se STARdesk som vedkommende — uden adgangskode eller login.
        </p>
        <div className="mt-4 space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Søg på navn eller e-mail…"
            autoFocus
          />
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="star-table-wrap max-h-[50vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Navn</TableHead>
                  <TableHead scope="col">Rolle</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Handling</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-sm">
                      Henter brugere…
                    </TableCell>
                  </TableRow>
                ) : sortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-sm">
                      Ingen brugere fundet.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{user.display_name}</div>
                        <div className="text-muted-foreground text-xs">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role_label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          disabled={submittingId !== null}
                          className={cn(submittingId === user.id && "opacity-70")}
                          onClick={() => fireAndForget(onImpersonate(user))}
                        >
                          {submittingId === user.id ? "Skifter…" : "Se som"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </AdminUserDialogPanel>
    </AdminUserModalBackdrop>
  );
}
