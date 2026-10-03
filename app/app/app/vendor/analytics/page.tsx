"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { orderStatusLabel } from "@/components/vendor/order-status";
import { ApiError, marketplaceApi } from "@/lib/api";

type Line = {
  order_id: string;
  product_name: string;
  total: number;
  status: string;
  placed_at: string;
};

export default function VendorAnalyticsPage() {
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
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Could not load analytics.");
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  if (!vendor) return null;

  const total = lines.reduce((sum, line) => sum + line.total, 0);
  const orders = new Set(lines.map((line) => line.order_id)).size;
  const byStatus = new Map<string, number>();
  const byProduct = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const line of lines) {
    byStatus.set(line.status, (byStatus.get(line.status) ?? 0) + 1);
    byProduct.set(line.product_name, (byProduct.get(line.product_name) ?? 0) + line.total);
    const month = line.placed_at.slice(0, 7);
    if (month) byMonth.set(month, (byMonth.get(month) ?? 0) + line.total);
  }
  const products = [...byProduct.entries()].sort((a, b) => b[1] - a[1]);
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-muted">Totals from this vendor&apos;s order lines. Amounts stay in USD.</p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Order lines" value={String(lines.length)} />
        <Stat label="Orders" value={String(orders)} />
        <Stat label="Line total" value={`$${total.toFixed(2)}`} />
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">Orders by status</h2>
          {byStatus.size === 0 ? (
            <p className="mt-3 text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {[...byStatus.entries()].map(([status, count]) => (
                <li key={status} className="flex justify-between">
                  <span>{orderStatusLabel(status)}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">Top products</h2>
          {products.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {products.map(([name, amount]) => (
                <li key={name}>
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">{name}</span>
                    <span>
                      ${amount.toFixed(2)}
                      {total > 0 ? ` · ${Math.round((amount / total) * 100)}%` : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--hero-tint)]">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: total > 0 ? `${(amount / total) * 100}%` : "0%" }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">Sales by month</h2>
        {months.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="mt-3 flex gap-3 overflow-x-auto">
            {months.map(([month, amount]) => (
              <li key={month} className="min-w-28 rounded-lg border border-border px-3 py-2 text-sm">
                <p className="text-xs text-muted">{month}</p>
                <p className="font-semibold">${amount.toFixed(2)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
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
