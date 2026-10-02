"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { fulfilmentLabel } from "@/components/marketplace/cards";
import { marketplaceApi } from "@/lib/api";

export default function WishlistPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [items, setItems] = useState<
    { product_id: string; name: string; vendor_name: string; fulfilment_type: string }[]
  >([]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const data = await marketplaceApi.wishlist(tenantId, ensureAccessToken);
    setItems(data.items);
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Wishlist</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing saved yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.product_id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
              <Link href={`/app/marketplace/products/${item.product_id}`}>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-muted">
                  {item.vendor_name} · {fulfilmentLabel(item.fulfilment_type)}
                </p>
              </Link>
              <button
                type="button"
                className="text-sm font-semibold text-primary"
                onClick={() => {
                  if (!tenantId) return;
                  void marketplaceApi.removeWishlist(tenantId, item.product_id, ensureAccessToken).then(load);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
