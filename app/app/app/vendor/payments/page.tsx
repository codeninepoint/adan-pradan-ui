"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type Payout = {
  period: string;
  gross: number;
  platform_fee: number;
  net: number;
  status: string;
};

export default function VendorPaymentsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<Payout[]>([]);
  const [current, setCurrent] = useState<Payout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    let cancelled = false;
    void marketplaceApi
      .vendorPayouts(vendorId, ensureAccessToken)
      .then((data) => {
        if (cancelled) return;
        setRows(data.payouts);
        setCurrent(data.this_period);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Could not load payouts.");
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  if (!vendor) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Payments & settlements</h1>
      <p className="mt-1 text-sm text-muted">
        Ledger rows written by billing. Amounts stay in USD. The fee on each row is the stored platform fee.
      </p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Latest gross" value={current ? `$${current.gross.toFixed(2)}` : "—"} />
        <Stat label="Latest platform fee" value={current ? `$${current.platform_fee.toFixed(2)}` : "—"} />
        <Stat label="Latest net" value={current ? `$${current.net.toFixed(2)}` : "—"} />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No settlement periods yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((row) => (
            <li key={row.period} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-5">
              <span className="font-semibold">{row.period}</span>
              <span>${row.gross.toFixed(2)}</span>
              <span className="text-muted">${row.platform_fee.toFixed(2)} fee</span>
              <span>${row.net.toFixed(2)} net</span>
              <span className="capitalize text-muted">{row.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
