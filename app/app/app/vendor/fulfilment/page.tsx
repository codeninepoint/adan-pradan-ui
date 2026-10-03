"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { fulfilmentLabel } from "@/components/marketplace/cards";
import { orderStatusLabel } from "@/components/vendor/order-status";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type Line = {
  line_id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  fulfilment_type: string;
  status: string;
  customer_name: string;
};

export default function VendorFulfilmentPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    let cancelled = false;
    void marketplaceApi
      .vendorOrders(vendorId, ensureAccessToken)
      .then((data) => {
        if (!cancelled) setLines(data.lines);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Could not load fulfilment.");
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  if (!vendor) return null;

  const statuses = [...new Set(lines.map((line) => line.status))];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Fulfilment</h1>
      <p className="mt-1 text-sm text-muted">
        Order lines grouped by this vendor&apos;s fulfilment status. Accept, pack, and ship from Orders.
      </p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      {lines.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No lines to fulfil.</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statuses.map((status) => {
            const group = lines.filter((line) => line.status === status);
            return (
              <section key={status} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">{orderStatusLabel(status)}</h2>
                  <span className="text-xs font-semibold text-muted">{group.length}</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {group.map((line) => (
                    <li key={line.line_id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="font-semibold">{line.product_name}</p>
                      <p className="text-muted">
                        {line.customer_name} · {fulfilmentLabel(line.fulfilment_type)} · × {line.quantity}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted">{line.order_id.slice(0, 8)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
