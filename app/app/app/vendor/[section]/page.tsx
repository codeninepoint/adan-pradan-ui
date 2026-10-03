import { notFound } from "next/navigation";
import { LATER_SECTIONS } from "@/components/vendor/sections";

export default async function VendorLaterPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const title = LATER_SECTIONS[section];
  if (!title) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        This section is next in the vendor portal. Overview already uses your live products, offerings, and installs.
      </p>
    </div>
  );
}
