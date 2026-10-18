"use client";

import { Suspense } from "react";
import { MarketplaceShop } from "@/components/marketplace/shop";

export default function BrowsePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading browse…</p>}>
      <MarketplaceShop />
    </Suspense>
  );
}
