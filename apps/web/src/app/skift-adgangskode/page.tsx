import { ChangePasswordForm } from "@/components/change-password-form";
import { StarLogo } from "@/components/star-logo";

type SkiftAdgangskodePageProps = {
  searchParams: Promise<{ required?: string }>;
};

export default async function SkiftAdgangskodePage({
  searchParams,
}: SkiftAdgangskodePageProps) {
  const params = await searchParams;
  const required = params.required === "1";

  if (required) {
    return <ChangePasswordForm required />;
  }

  return (
    <main className="star-page px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <StarLogo className="size-10" />
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">STARdesk</h1>
        <p className="text-muted-foreground text-sm">Skift din adgangskode</p>
      </div>
      <ChangePasswordForm required={false} />
    </main>
  );
}
