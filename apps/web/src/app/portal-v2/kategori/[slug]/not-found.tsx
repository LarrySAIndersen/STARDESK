import Link from "next/link";

export default function PortalCategoryNotFound() {
  return (
    <div className="portal-v2-page mx-auto max-w-lg p-6 text-center">
      <h1 className="text-star-navy text-lg font-bold">Kategori ikke fundet</h1>
      <p className="text-[var(--gray-mid)] mt-2 text-sm">
        Den ønskede kategori findes ikke. Gå tilbage til oversigten.
      </p>
      <Link href="/portal" className="text-star-red mt-4 inline-block text-sm font-semibold">
        Tilbage til oversigt
      </Link>
    </div>
  );
}
