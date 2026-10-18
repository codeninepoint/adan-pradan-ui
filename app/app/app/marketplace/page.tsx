"use client";

import { Suspense } from "react";
import { MarketplaceShop } from "@/components/marketplace/shop";

export default function MarketplaceHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading marketplace…</p>}>
      <MarketplaceShop />
    </Suspense>
  );
}
