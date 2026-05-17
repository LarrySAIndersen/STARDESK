import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TicketListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sager</CardTitle>
        <CardDescription>Henter sager…</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground animate-pulse text-sm">
          Henter sager…
        </p>
      </CardContent>
    </Card>
  );
}
