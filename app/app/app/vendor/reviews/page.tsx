"use client";

import { useVendorPortal } from "@/components/vendor/portal";

export default function VendorReviewsPage() {
  const { vendor } = useVendorPortal();
  if (!vendor) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
      <p className="mt-1 text-sm text-muted">Buyer comments on your products will list here.</p>
      <p className="mt-6 text-sm text-muted">No reviews are on file.</p>
    </div>
  );
}
