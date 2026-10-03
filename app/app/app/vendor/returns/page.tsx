"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type ReturnItem = {
  return_id: string;
  order_id: string;
  product_name: string;
  reason: string;
  notes: string;
  status: string;
  created_at: string;
  customer_name: string;
};

export default function VendorReturnsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<ReturnItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    let cancelled = false;
    void marketplaceApi
      .vendorReturns(vendorId, ensureAccessToken)
      .then((data) => {
        if (!cancelled) setRows(data.returns);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Could not load returns.");
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  if (!vendor) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
      <p className="mt-1 text-sm text-muted">
        Return requests buyers filed against your order lines. Status stays requested until a later refund step.
      </p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No return requests yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.return_id} className="rounded-xl border border-border bg-surface p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{row.product_name}</p>
                <span className="text-xs font-semibold capitalize text-muted">{row.status}</span>
              </div>
              <p className="mt-1 text-muted">
                {row.customer_name} · {row.reason}
              </p>
              {row.notes && <p className="mt-1 text-muted">{row.notes}</p>}
              <p className="mt-2 font-mono text-xs text-muted">
                {row.order_id.slice(0, 8)} · {row.created_at.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
