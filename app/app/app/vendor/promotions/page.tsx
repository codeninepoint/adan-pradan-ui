"use client";

import { useVendorPortal } from "@/components/vendor/portal";

export default function VendorPromotionsPage() {
  const { vendor } = useVendorPortal();
  if (!vendor) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
      <p className="mt-1 text-sm text-muted">
        Coupon codes for your products will list here. Checkout charges the stored USD price on each offering.
      </p>
      <p className="mt-6 text-sm text-muted">No promotion codes are on file.</p>
    </div>
  );
}
