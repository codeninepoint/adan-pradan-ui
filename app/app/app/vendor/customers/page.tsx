"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type Customer = {
  tenant_id: string;
  customer_name: string;
  order_count: number;
  total: number;
  last_order_at: string;
};

export default function VendorCustomersPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    let cancelled = false;
    void marketplaceApi
      .vendorCustomers(vendorId, ensureAccessToken)
      .then((data) => {
        if (!cancelled) setRows(data.customers);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Could not load customers.");
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  if (!vendor) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
      <p className="mt-1 text-sm text-muted">
        One row per buyer who has an order line for this vendor. Totals stay in USD.
      </p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No buyers yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((row) => (
            <li key={row.tenant_id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-4">
              <span className="font-semibold">{row.customer_name}</span>
              <span className="text-muted">{row.order_count} orders</span>
              <span>${row.total.toFixed(2)}</span>
              <span className="text-muted">{row.last_order_at.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
