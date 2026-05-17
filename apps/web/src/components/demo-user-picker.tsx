"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEMO_PASSWORD, groupDemoUsers, type DemoUser } from "@/lib/demo-users";

export function DemoUserPicker({
  selectedEmail,
  onSelect,
  onQuickLogin,
  isSubmitting,
}: {
  selectedEmail: string;
  onSelect: (user: DemoUser) => void;
  onQuickLogin: (user: DemoUser) => void;
  isSubmitting: boolean;
}) {
  const groups = groupDemoUsers();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-star-navy text-lg font-semibold">Vælg testbruger</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Klik en række for at udfylde login — eller brug{" "}
          <span className="font-medium">Log ind</span> direkte. Standardadgangskode:{" "}
          <span className="font-mono">{DEMO_PASSWORD}</span>
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.title} className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            {group.title}
          </h3>
          <div className="star-table-wrap rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Rolle</TableHead>
                  <TableHead scope="col">Navn</TableHead>
                  <TableHead scope="col">E-mail</TableHead>
                  <TableHead scope="col">Adgangskode</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Handling</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.users.map((user) => {
                  const selected = selectedEmail === user.email;
                  return (
                    <TableRow
                      key={user.email}
                      data-state={selected ? "selected" : undefined}
                      className={`cursor-pointer ${selected ? "bg-star-blue-light" : ""}`}
                      onClick={() => onSelect(user)}
                    >
                      <TableCell>
                        <Badge variant={user.roleLabel === "Administrator" ? "default" : "outline"}>
                          {user.roleLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{user.displayName}</TableCell>
                      <TableCell className="font-mono text-xs">{user.email}</TableCell>
                      <TableCell className="font-mono text-xs">{user.password}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          className={selected ? "bg-star-blue hover:bg-star-navy" : ""}
                          disabled={isSubmitting}
                          onClick={(event) => {
                            event.stopPropagation();
                            onQuickLogin(user);
                          }}
                        >
                          Log ind
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
