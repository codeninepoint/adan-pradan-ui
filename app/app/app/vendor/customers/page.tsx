"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Customer = {
  tenant_id: string;
  customer_name: string;
  order_count: number;
  total: number;
  last_order_at: string;
  city: string;
  currency: string;
  segment: string;
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

  const totalCustomers = rows.length;
  const repeatCustomers = useMemo(
    () => rows.filter((row) => row.order_count >= 2).length,
    [rows],
  );
  const retentionRate = totalCustomers > 0 ? Math.round((100 * repeatCustomers) / totalCustomers) : 0;

  if (!vendor) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
      <p className="mt-1 text-sm text-muted">Customers who&apos;ve ordered from you.</p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total customers" value={String(totalCustomers)} />
        <StatCard label="Repeat customers" value={String(repeatCustomers)} />
        <StatCard label="Retention rate" value={`${retentionRate}%`} />
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No buyers yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Total spent</th>
                <th className="px-4 py-3">Last order</th>
                <th className="px-4 py-3">Segment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tenant_id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold">{row.customer_name}</td>
                  <td className="px-4 py-3 text-muted">{row.city || "—"}</td>
                  <td className="px-4 py-3">{row.order_count}</td>
                  <td className="px-4 py-3 font-semibold">
                    {formatMoney(row.total, row.currency || "INR")}
                  </td>
                  <td className="px-4 py-3 text-muted">{relativeLastOrder(row.last_order_at)}</td>
                  <td className="px-4 py-3">
                    <SegmentBadge segment={row.segment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function SegmentBadge({ segment }: { segment: string }) {
  const styles: Record<string, string> = {
    VIP: "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-300",
    Regular: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
    New: "border-border bg-background text-muted",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        styles[segment] ?? styles.New
      }`}
    >
      {segment}
    </span>
  );
}

function relativeLastOrder(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday.getTime() - startThen.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 14) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
