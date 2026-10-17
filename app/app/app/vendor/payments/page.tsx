"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";
import { formatCompactMoney, formatMoney } from "@/lib/money";

type Payout = {
  settlement_id: string;
  period: string;
  gross: number;
  platform_fee: number;
  net: number;
  status: string;
};

type PayoutSummary = {
  earned_this_month: number;
  next_settlement: number | null;
  next_settlement_due_days: number | null;
  commission_this_month: number;
  commission_rate_pct: number;
  total_settled: number;
};

const EMPTY_SUMMARY: PayoutSummary = {
  earned_this_month: 0,
  next_settlement: null,
  next_settlement_due_days: null,
  commission_this_month: 0,
  commission_rate_pct: 10,
  total_settled: 0,
};

export default function VendorPaymentsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary>(EMPTY_SUMMARY);
  const [currency, setCurrency] = useState("INR");
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
        setSummary(data.summary ?? EMPTY_SUMMARY);
        setCurrency(data.currency || "INR");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Could not load payouts.");
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  if (!vendor) return null;

  const dueDays = summary.next_settlement_due_days;
  const dueLabel =
    dueDays === null || dueDays === undefined
      ? null
      : dueDays === 0
        ? "Due today"
        : `Due in ${dueDays} days`;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Payments & Settlements</h1>
      <p className="mt-1 text-sm text-muted">Track revenue, settlements, and platform commission.</p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Earned this month"
          value={formatCompactMoney(summary.earned_this_month, currency)}
        />
        <StatCard
          label="Next settlement"
          value={
            summary.next_settlement === null || summary.next_settlement === undefined
              ? "—"
              : formatCompactMoney(summary.next_settlement, currency)
          }
          badge={dueLabel}
        />
        <StatCard
          label={`Platform commission (${summary.commission_rate_pct}%)`}
          value={formatCompactMoney(summary.commission_this_month, currency)}
        />
        <StatCard
          label="Total settled (all time)"
          value={formatCompactMoney(summary.total_settled, currency)}
        />
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Settlement history
        </h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No settlement periods yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Settlement ID</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Net payout</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.settlement_id + row.period} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">{row.settlement_id}</td>
                    <td className="px-4 py-3 text-muted">{row.period}</td>
                    <td className="px-4 py-3">{formatMoney(row.gross, currency)}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatMoney(row.platform_fee, currency)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatMoney(row.net, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {badge ? (
        <span className="mt-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-400">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "—";
  const paid = status.toLowerCase() === "paid";
  return (
    <span
      className={
        paid
          ? "rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success"
          : "rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-bold text-muted"
      }
    >
      {label}
    </span>
  );
}
