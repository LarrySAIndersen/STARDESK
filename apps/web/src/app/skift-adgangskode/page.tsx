import { ChangePasswordForm } from "@/components/change-password-form";

export default function SkiftAdgangskodePage() {
  return (
    <main className="star-page px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">STARdesk</h1>
        <p className="text-muted-foreground mt-2 text-sm">Skift din adgangskode</p>
      </div>
      <ChangePasswordForm />
    </main>
  );
}
