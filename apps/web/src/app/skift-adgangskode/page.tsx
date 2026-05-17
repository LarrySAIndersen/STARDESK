import { ChangePasswordForm } from "@/components/change-password-form";
import { StarLogo } from "@/components/star-logo";

export default function SkiftAdgangskodePage() {
  return (
    <main className="star-page px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <StarLogo className="h-10" />
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">STARdesk</h1>
        <p className="text-muted-foreground text-sm">Skift din adgangskode</p>
      </div>
      <ChangePasswordForm />
    </main>
  );
}
