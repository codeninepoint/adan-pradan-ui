"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { marketplaceApi } from "@/lib/api";

export default function ReturnsPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [items, setItems] = useState<
    { return_id: string; order_id: string; product_name: string; reason: string; status: string }[]
  >([]);

  useEffect(() => {
    if (!tenantId) return;
    void marketplaceApi.returns(tenantId, ensureAccessToken).then((data) => setItems(data.returns));
  }, [tenantId, ensureAccessToken]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Returns & refunds</h1>
      <p className="mt-1 text-sm text-muted">A return records the request. Refunds are not processed here.</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No returns yet. Open an order to request one.</p>
      ) : (
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.return_id} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-semibold">{item.product_name}</p>
              <p className="text-muted">
                {item.status} · {item.reason} ·{" "}
                <Link href={`/app/marketplace/orders/${item.order_id}`} className="text-primary">
                  order
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
